// The Passepartout API (spec 024). A small Fastify app: single-password auth via a signed
// cookie, project documents (opaque JSON) and image blobs. Everything under the API requires
// the session except `health` and the login/logout endpoints. Behind nginx the SPA reaches
// these at /api/* (the proxy strips the prefix), so routes here are at the root.

import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import { Store, isSafeId } from "./db";
import { verifyPassword } from "./auth";
import { readCurrentVersion, fetchLatest, isNewer } from "./version";
import { isDockerAvailable, isUpdating, startUpdate, MANUAL_COMMAND } from "./updater";

const SESSION_COOKIE = "pp_session";
const SESSION_VALUE = "ok";
// 64 MB body cap: large enough for a full-resolution photo, bounded so a client cannot
// exhaust memory.
const BODY_LIMIT = 64 * 1024 * 1024;

export interface AppConfig {
  store: Store;
  passwordHash: string;
  sessionSecret: string;
  cookieSecure: boolean;
  /** Optional GitHub token to read the latest release of a private repo (spec 025). */
  githubToken?: string;
}

export function buildApp(cfg: AppConfig): FastifyInstance {
  const app = Fastify({ logger: false, bodyLimit: BODY_LIMIT });
  app.register(cookie, { secret: cfg.sessionSecret });

  // Accept raw image bytes on image uploads (Fastify only parses JSON/text by default).
  const asBuffer = (_req: FastifyRequest, body: Buffer, done: (e: Error | null, b?: Buffer) => void) => done(null, body);
  app.addContentTypeParser(/^image\//, { parseAs: "buffer" }, asBuffer);
  app.addContentTypeParser("application/octet-stream", { parseAs: "buffer" }, asBuffer);

  const isAuthed = (req: FastifyRequest): boolean => {
    const raw = req.cookies?.[SESSION_COOKIE];
    if (!raw) return false;
    const un = req.unsignCookie(raw);
    return un.valid && un.value === SESSION_VALUE;
  };

  // Gate the whole API except health and the login/logout endpoints. `auth/me` is gated on
  // purpose: it returns 401 when not authenticated, which is exactly the check the app needs.
  app.addHook("onRequest", async (req, reply) => {
    const open =
      (req.method === "GET" && req.url === "/health") ||
      (req.method === "POST" && (req.url === "/auth/login" || req.url === "/auth/logout"));
    if (open) return;
    if (!isAuthed(req)) {
      reply.code(401).send({ error: "unauthorized" });
    }
  });

  app.get("/health", async () => ({ status: "ok" }));

  app.post("/auth/login", async (req, reply) => {
    const body = (req.body ?? {}) as { password?: string };
    if (!body.password || !verifyPassword(body.password, cfg.passwordHash)) {
      return reply.code(401).send({ error: "invalid password" });
    }
    reply.setCookie(SESSION_COOKIE, SESSION_VALUE, {
      signed: true,
      httpOnly: true,
      sameSite: "lax",
      secure: cfg.cookieSecure,
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    return { ok: true };
  });

  app.post("/auth/logout", async (_req, reply) => {
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });

  app.get("/auth/me", async () => ({ ok: true }));

  // --- Version / update (spec 025) ---

  app.get("/version", async () => {
    const current = readCurrentVersion();
    const latest = await fetchLatest(cfg.githubToken);
    return {
      current,
      latest,
      updateAvailable: latest ? isNewer(current, latest) : false,
      canApply: isDockerAvailable(),
    };
  });

  // Opt-in one-click update: requires the Docker socket. Without it, 409 + the manual command.
  app.post("/update", async (_req, reply) => {
    if (!isDockerAvailable()) {
      return reply.code(409).send({ error: "one-click update unavailable", manualCommand: MANUAL_COMMAND });
    }
    if (isUpdating()) {
      return reply.code(409).send({ error: "update already in progress", manualCommand: MANUAL_COMMAND });
    }
    const res = await startUpdate();
    if (!res.started) {
      return reply.code(409).send({ error: res.error ?? "could not start update", manualCommand: MANUAL_COMMAND });
    }
    return reply.code(202).send({ started: true });
  });

  // --- Projects (the doc is stored and returned opaque) ---

  app.get("/projects", async () => cfg.store.listProjects());

  app.get("/projects/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const doc = cfg.store.getDoc(id);
    if (!doc) return reply.code(404).send({ error: "not found" });
    reply.header("content-type", "application/json");
    return doc; // already a JSON string
  });

  const saveDoc = (req: FastifyRequest, reply: import("fastify").FastifyReply) => {
    const doc = req.body as { id?: unknown } | null;
    if (!doc || typeof doc !== "object" || typeof doc.id !== "string" || !isSafeId(doc.id)) {
      return reply.code(400).send({ error: "invalid project document" });
    }
    cfg.store.putDoc(doc as Parameters<Store["putDoc"]>[0]);
    return { ok: true, id: doc.id };
  };

  app.post("/projects", async (req, reply) => saveDoc(req, reply));

  app.put("/projects/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const doc = req.body as { id?: unknown } | null;
    if (!doc || typeof doc !== "object" || doc.id !== id) {
      return reply.code(400).send({ error: "id mismatch" });
    }
    return saveDoc(req, reply);
  });

  app.delete("/projects/:id", async (req) => {
    const { id } = req.params as { id: string };
    cfg.store.deleteProject(id);
    return { ok: true };
  });

  // --- Images (raw bytes on a filesystem volume) ---

  app.get("/images/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!isSafeId(id)) return reply.code(400).send({ error: "bad id" });
    const img = cfg.store.getImage(id);
    if (!img) return reply.code(404).send({ error: "not found" });
    reply.header("content-type", img.mime);
    reply.header("cache-control", "public, max-age=31536000, immutable");
    return reply.send(img.bytes);
  });

  app.put("/images/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!isSafeId(id)) return reply.code(400).send({ error: "bad id" });
    const body = req.body as unknown;
    if (!Buffer.isBuffer(body)) return reply.code(400).send({ error: "expected image bytes" });
    const mime = String(req.headers["content-type"] ?? "application/octet-stream").split(";")[0];
    cfg.store.putImage(id, body, mime);
    return { ok: true };
  });

  return app;
}
