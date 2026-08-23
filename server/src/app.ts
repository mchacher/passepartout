// The Passepartout API (spec 024, 026). A small Fastify app: user-account auth via a signed
// session cookie, project documents (opaque JSON) and image blobs. Everything under the API
// requires a logged-in user except health, auth/status and the setup/login/logout endpoints.
// Behind nginx the SPA reaches these at /api/* (the proxy strips the prefix), so routes here
// are at the root.

import { randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { Store, isSafeId } from "./db";
import { hashPassword, needsRehash, verifyPassword } from "./auth";
import { readCurrentVersion, fetchLatest, isNewer } from "./version";
import { isDockerAvailable, isUpdating, startUpdate, MANUAL_COMMAND } from "./updater";

const SESSION_COOKIE = "pp_session";
// 64 MB body cap: large enough for a full-resolution photo, bounded so a client cannot
// exhaust memory.
const BODY_LIMIT = 64 * 1024 * 1024;
const MIN_PASSWORD = 8;

// Rate limiting (issue 78). Passwords are verified with bcrypt in SYNCHRONOUS mode, so every
// attempt blocks the event loop for 60 to 100 ms. /auth/login is the only endpoint reachable
// without a session, which makes an unlimited one a way to freeze the whole instance long
// before it is a way to guess a password. Hence a tight budget on the routes that verify a
// password, and a loose one everywhere else.
const AUTH_MAX = 10; // password attempts per window, per client
const AUTH_WINDOW = "1 minute";
const GLOBAL_MAX = 600; // everything else, per window, per client
const GLOBAL_WINDOW = "1 minute";
// Serving an album is bursty by nature: opening a book with a hundred photos fires a hundred
// image requests at once. They are cheap and authenticated, so they are never throttled.
const isImageRequest = (url: string): boolean => url.startsWith("/images/");

/** The per-route budget for an endpoint that verifies a password. */
const authLimit = { config: { rateLimit: { max: AUTH_MAX, timeWindow: AUTH_WINDOW } } };

export interface AppConfig {
  store: Store;
  sessionSecret: string;
  cookieSecure: boolean;
  /**
   * Whether to read the client address from X-Forwarded-For (issue 78). Defaults to trusting
   * exactly ONE hop, the shipped nginx, so the rate limit is keyed on the real client instead
   * of on the proxy. Pass false when the API is exposed directly with no proxy in front:
   * trusting a hop there would let a client forge the header and rotate past the limit.
   */
  trustProxy?: boolean;
  /** Optional GitHub token to read the latest release of a private repo (spec 025). */
  githubToken?: string;
}

/**
 * Build the API. Async because the rate limiter has to be LOADED before the routes are
 * declared: Fastify applies a plugin's hooks only to routes registered after it, and
 * `register` alone is deferred to `ready()`, which would leave every route unthrottled.
 */
export async function buildApp(cfg: AppConfig): Promise<FastifyInstance> {
  // Behind the shipped nginx the socket address is the proxy's, so without this every client
  // would share one rate-limit bucket and an attacker would throttle everyone else. One hop is
  // trusted, not the whole X-Forwarded-For chain, so a client cannot spoof its way past the
  // limit by prepending addresses.
  // Trust exactly one hop: the immediate peer (nginx) is a proxy, whatever it forwards beyond
  // that is not. A bare `true` would trust the whole chain and take the leftmost entry, which
  // any client can write.
  const oneHop = (_address: string, hop: number) => hop === 0;
  const trustProxy = cfg.trustProxy === false ? false : oneHop;
  const app = Fastify({ logger: false, bodyLimit: BODY_LIMIT, trustProxy });
  await app.register(cookie, { secret: cfg.sessionSecret });
  await app.register(rateLimit, {
    global: true,
    max: GLOBAL_MAX,
    timeWindow: GLOBAL_WINDOW,
    allowList: (req) => isImageRequest(req.url),
  });

  // Accept raw image bytes on image uploads (Fastify only parses JSON/text by default).
  const asBuffer = (_req: FastifyRequest, body: Buffer, done: (e: Error | null, b?: Buffer) => void) => done(null, body);
  app.addContentTypeParser(/^image\//, { parseAs: "buffer" }, asBuffer);
  app.addContentTypeParser("application/octet-stream", { parseAs: "buffer" }, asBuffer);

  // The logged-in user id from the signed cookie, or null. The session is valid only while the
  // user still exists (so a deleted account's session stops working).
  const currentUserId = (req: FastifyRequest): string | null => {
    const raw = req.cookies?.[SESSION_COOKIE];
    if (!raw) return null;
    const un = req.unsignCookie(raw);
    if (!un.valid || !un.value) return null;
    return cfg.store.getUser(un.value) ? un.value : null;
  };
  const setSession = (reply: FastifyReply, userId: string) =>
    reply.setCookie(SESSION_COOKIE, userId, {
      signed: true,
      httpOnly: true,
      sameSite: "lax",
      secure: cfg.cookieSecure,
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  const badUsername = (u?: string) => !u || u.trim().length === 0;
  const badPassword = (p?: string) => !p || p.length < MIN_PASSWORD;

  // Gate the whole API except health, auth/status and the setup/login/logout endpoints.
  app.addHook("onRequest", async (req, reply) => {
    const open =
      (req.method === "GET" && (req.url === "/health" || req.url === "/auth/status")) ||
      (req.method === "POST" && (req.url === "/auth/setup" || req.url === "/auth/login" || req.url === "/auth/logout"));
    if (open) return;
    if (!currentUserId(req)) {
      reply.code(401).send({ error: "unauthorized" });
    }
  });

  app.get("/health", async () => ({ status: "ok" }));

  // --- Auth & first-run setup (spec 026) ---

  app.get("/auth/status", async (req) => ({
    needsSetup: cfg.store.countUsers() === 0,
    authed: currentUserId(req) !== null,
  }));

  app.post("/auth/setup", authLimit, async (req, reply) => {
    if (cfg.store.countUsers() > 0) return reply.code(409).send({ error: "setup already completed" });
    const { username, password } = (req.body ?? {}) as { username?: string; password?: string };
    if (badUsername(username)) return reply.code(400).send({ error: "username is required" });
    if (badPassword(password)) return reply.code(400).send({ error: `password must be at least ${MIN_PASSWORD} characters` });
    const id = randomUUID();
    cfg.store.createUser(id, username!.trim(), await hashPassword(password!), Date.now());
    setSession(reply, id);
    return reply.code(201).send({ id, username: username!.trim() });
  });

  app.post("/auth/login", authLimit, async (req, reply) => {
    const { username, password } = (req.body ?? {}) as { username?: string; password?: string };
    if (!username || !password) return reply.code(401).send({ error: "invalid credentials" });
    const user = cfg.store.findUserByName(username.trim());
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return reply.code(401).send({ error: "invalid credentials" });
    }
    // Transparent migration (issue 80): an account created before the move to scrypt still has
    // its bcrypt hash. The password is only in hand here, at a successful sign-in, so this is
    // the one place it can be rewritten. Best effort: a failed rewrite must not fail the login,
    // the next sign-in will try again.
    if (needsRehash(user.passwordHash)) {
      try {
        cfg.store.updateUserPassword(user.id, await hashPassword(password));
      } catch {
        /* keep the old hash, the user is still signed in */
      }
    }
    setSession(reply, user.id);
    return { id: user.id, username: user.username };
  });

  app.post("/auth/logout", async (_req, reply) => {
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });

  app.get("/auth/me", async (req, reply) => {
    const id = currentUserId(req);
    const user = id ? cfg.store.getUser(id) : undefined;
    if (!user) return reply.code(401).send({ error: "unauthorized" });
    return user;
  });

  // --- Users (spec 026): any logged-in user manages accounts (no roles) ---

  app.get("/users", async () => cfg.store.listUsers());

  app.post("/users", async (req, reply) => {
    const { username, password } = (req.body ?? {}) as { username?: string; password?: string };
    if (badUsername(username)) return reply.code(400).send({ error: "username is required" });
    if (badPassword(password)) return reply.code(400).send({ error: `password must be at least ${MIN_PASSWORD} characters` });
    try {
      const id = randomUUID();
      cfg.store.createUser(id, username!.trim(), await hashPassword(password!), Date.now());
      return reply.code(201).send({ id, username: username!.trim() });
    } catch {
      return reply.code(409).send({ error: "username already taken" });
    }
  });

  app.delete("/users/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (cfg.store.countUsers() <= 1) return reply.code(409).send({ error: "cannot delete the last user" });
    cfg.store.deleteUser(id);
    return { ok: true };
  });

  app.post("/account/password", authLimit, async (req, reply) => {
    const id = currentUserId(req)!; // gated: always present
    const { currentPassword, newPassword } = (req.body ?? {}) as { currentPassword?: string; newPassword?: string };
    const hash = cfg.store.getUserHash(id);
    if (!hash || !currentPassword || !(await verifyPassword(currentPassword, hash))) {
      return reply.code(401).send({ error: "current password is incorrect" });
    }
    if (badPassword(newPassword)) return reply.code(400).send({ error: `password must be at least ${MIN_PASSWORD} characters` });
    cfg.store.updateUserPassword(id, await hashPassword(newPassword!));
    return { ok: true };
  });

  // --- Version / update (spec 025) ---

  app.get("/version", async (req) => {
    const force = (req.query as { refresh?: string })?.refresh === "1";
    const current = readCurrentVersion();
    const latest = await fetchLatest(cfg.githubToken, { force });
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
      return reply.code(409).send({ error: "update already in progress", inProgress: true, manualCommand: MANUAL_COMMAND });
    }
    const res = await startUpdate();
    if (!res.started) {
      return reply.code(409).send({ error: res.error ?? "could not start update", inProgress: res.inProgress, manualCommand: MANUAL_COMMAND });
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

  // The ids of every stored image, so the client can reclaim what deleted photos left behind
  // (spec 037). Ids only, no bytes.
  app.get("/images", async () => ({ ids: cfg.store.listImageIds() }));

  // Drop one image: a photo deleted from the library (issue 66). Idempotent, like the
  // project delete: removing an id that is already gone still answers ok.
  app.delete("/images/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!isSafeId(id)) return reply.code(400).send({ error: "bad id" });
    cfg.store.deleteImage(id);
    return { ok: true };
  });

  return app;
}
