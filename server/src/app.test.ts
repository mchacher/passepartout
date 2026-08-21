import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app";
import { Store } from "./db";
import { hashPassword } from "./auth";

const PASSWORD = "correct horse battery";

function makeApp(): FastifyInstance {
  const dir = mkdtempSync(join(tmpdir(), "pp-srv-"));
  const store = new Store(":memory:", dir);
  return buildApp({
    store,
    passwordHash: hashPassword(PASSWORD),
    sessionSecret: "test-secret-not-for-production",
    cookieSecure: false,
  });
}

async function login(app: FastifyInstance): Promise<string> {
  const res = await app.inject({ method: "POST", url: "/auth/login", payload: { password: PASSWORD } });
  const c = res.cookies.find((x) => x.name === "pp_session");
  if (!c) throw new Error("no session cookie");
  return `pp_session=${c.value}`;
}

const doc = (id: string, name = "Trip") => ({ id, name, createdAt: 1, updatedAt: 1, photos: [], pages: [] });

describe("server", () => {
  it("serves health without auth", async () => {
    const app = makeApp();
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "ok" });
    await app.close();
  });

  it("gates the API without a session", async () => {
    const app = makeApp();
    expect((await app.inject({ method: "GET", url: "/projects" })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/auth/me" })).statusCode).toBe(401);
    await app.close();
  });

  it("rejects a wrong password and accepts the right one", async () => {
    const app = makeApp();
    expect((await app.inject({ method: "POST", url: "/auth/login", payload: { password: "nope" } })).statusCode).toBe(401);
    const ok = await app.inject({ method: "POST", url: "/auth/login", payload: { password: PASSWORD } });
    expect(ok.statusCode).toBe(200);
    expect(ok.cookies.find((c) => c.name === "pp_session")).toBeTruthy();
    await app.close();
  });

  it("does project CRUD when authenticated", async () => {
    const app = makeApp();
    const cookie = await login(app);
    const id = "11111111-1111-4111-8111-111111111111";

    expect((await app.inject({ method: "POST", url: "/projects", headers: { cookie }, payload: doc(id) })).statusCode).toBe(200);

    const list = await app.inject({ method: "GET", url: "/projects", headers: { cookie } });
    expect(list.json()).toHaveLength(1);
    expect(list.json()[0]).toMatchObject({ id, name: "Trip" });

    const got = await app.inject({ method: "GET", url: `/projects/${id}`, headers: { cookie } });
    expect(got.json().name).toBe("Trip");

    await app.inject({ method: "PUT", url: `/projects/${id}`, headers: { cookie }, payload: doc(id, "Trip 2") });
    expect((await app.inject({ method: "GET", url: `/projects/${id}`, headers: { cookie } })).json().name).toBe("Trip 2");

    await app.inject({ method: "DELETE", url: `/projects/${id}`, headers: { cookie } });
    expect((await app.inject({ method: "GET", url: `/projects/${id}`, headers: { cookie } })).statusCode).toBe(404);
    await app.close();
  });

  it("round-trips an image with its mime", async () => {
    const app = makeApp();
    const cookie = await login(app);
    const id = "22222222-2222-4222-8222-222222222222";
    const bytes = Buffer.from([1, 2, 3, 4, 5, 255, 0, 128]);

    const put = await app.inject({
      method: "PUT",
      url: `/images/${id}`,
      headers: { cookie, "content-type": "image/png" },
      payload: bytes,
    });
    expect(put.statusCode).toBe(200);

    const got = await app.inject({ method: "GET", url: `/images/${id}`, headers: { cookie } });
    expect(got.statusCode).toBe(200);
    expect(got.headers["content-type"]).toContain("image/png");
    expect(got.headers["cache-control"]).toContain("immutable");
    expect(Buffer.from(got.rawPayload)).toEqual(bytes);
    await app.close();
  });

  it("rejects an unsafe image id (path traversal)", async () => {
    const app = makeApp();
    const cookie = await login(app);
    const res = await app.inject({ method: "GET", url: "/images/..%2f..%2fetc%2fpasswd", headers: { cookie } });
    expect([400, 404]).toContain(res.statusCode);
    await app.close();
  });
});
