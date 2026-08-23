import { describe, it, expect, vi, afterEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app";
import { Store } from "./db";
import { clearVersionCache } from "./version";

// No Docker socket in tests: force the "unavailable" path so /update 409s deterministically.
process.env.DOCKER_SOCKET_PATH = "/tmp/passepartout-no-such.sock";

const USER = "alice";
const PASSWORD = "correct horse battery";

async function makeApp(): Promise<FastifyInstance> {
  const dir = mkdtempSync(join(tmpdir(), "pp-srv-"));
  const store = new Store(":memory:", dir);
  return buildApp({ store, sessionSecret: "test-secret-not-for-production", cookieSecure: false });
}

const cookieOf = (res: { cookies: { name: string; value: string }[] }): string => {
  const c = res.cookies.find((x) => x.name === "pp_session");
  if (!c) throw new Error("no session cookie");
  return `pp_session=${c.value}`;
};

// Create the first account (first-run setup) and return its session cookie.
async function setupAndCookie(app: FastifyInstance, username = USER, password = PASSWORD): Promise<string> {
  const res = await app.inject({ method: "POST", url: "/auth/setup", payload: { username, password } });
  if (res.statusCode !== 201) throw new Error(`setup failed: ${res.statusCode}`);
  return cookieOf(res);
}

const doc = (id: string, name = "Trip") => ({ id, name, createdAt: 1, updatedAt: 1, photos: [], pages: [] });

describe("server auth & users (spec 026)", () => {
  it("serves health + status without auth; a fresh db needs setup", async () => {
    const app = await makeApp();
    expect((await app.inject({ method: "GET", url: "/health" })).statusCode).toBe(200);
    const status = await app.inject({ method: "GET", url: "/auth/status" });
    expect(status.statusCode).toBe(200);
    expect(status.json()).toMatchObject({ needsSetup: true, authed: false });
    await app.close();
  });

  it("gates the API before setup", async () => {
    const app = await makeApp();
    expect((await app.inject({ method: "GET", url: "/projects" })).statusCode).toBe(401);
    await app.close();
  });

  it("first-run setup creates the first user + logs in; a second setup is refused", async () => {
    const app = await makeApp();
    const res = await app.inject({ method: "POST", url: "/auth/setup", payload: { username: USER, password: PASSWORD } });
    expect(res.statusCode).toBe(201);
    expect(res.json().username).toBe(USER);
    const cookie = cookieOf(res);
    expect((await app.inject({ method: "GET", url: "/auth/status", headers: { cookie } })).json()).toMatchObject({
      needsSetup: false,
      authed: true,
    });
    expect(
      (await app.inject({ method: "POST", url: "/auth/setup", payload: { username: "bob", password: PASSWORD } })).statusCode,
    ).toBe(409);
    await app.close();
  });

  it("rejects a short password at setup", async () => {
    const app = await makeApp();
    expect((await app.inject({ method: "POST", url: "/auth/setup", payload: { username: USER, password: "short" } })).statusCode).toBe(400);
    await app.close();
  });

  it("logs in with the right credentials, rejects wrong ones", async () => {
    const app = await makeApp();
    await setupAndCookie(app);
    expect((await app.inject({ method: "POST", url: "/auth/login", payload: { username: USER, password: "nope" } })).statusCode).toBe(401);
    const ok = await app.inject({ method: "POST", url: "/auth/login", payload: { username: USER, password: PASSWORD } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().username).toBe(USER);
    await app.close();
  });

  it("me returns the current user", async () => {
    const app = await makeApp();
    const cookie = await setupAndCookie(app);
    const me = await app.inject({ method: "GET", url: "/auth/me", headers: { cookie } });
    expect(me.statusCode).toBe(200);
    expect(me.json().username).toBe(USER);
    await app.close();
  });

  it("manages users: add, dup 409, list, delete (not the last)", async () => {
    const app = await makeApp();
    const cookie = await setupAndCookie(app); // alice
    const add = await app.inject({ method: "POST", url: "/users", headers: { cookie }, payload: { username: "bob", password: PASSWORD } });
    expect(add.statusCode).toBe(201);
    expect(
      (await app.inject({ method: "POST", url: "/users", headers: { cookie }, payload: { username: "ALICE", password: PASSWORD } })).statusCode,
    ).toBe(409); // case-insensitive dup
    const list = (await app.inject({ method: "GET", url: "/users", headers: { cookie } })).json() as { id: string; username: string }[];
    expect(list).toHaveLength(2);
    // bob can log in (shared instance)
    expect((await app.inject({ method: "POST", url: "/auth/login", payload: { username: "bob", password: PASSWORD } })).statusCode).toBe(200);
    // delete bob ok, then the last (alice) is refused
    expect((await app.inject({ method: "DELETE", url: `/users/${add.json().id}`, headers: { cookie } })).statusCode).toBe(200);
    const aliceId = list.find((u) => u.username === USER)!.id;
    expect((await app.inject({ method: "DELETE", url: `/users/${aliceId}`, headers: { cookie } })).statusCode).toBe(409);
    await app.close();
  });

  it("changes own password (wrong current -> 401, then login with the new one)", async () => {
    const app = await makeApp();
    const cookie = await setupAndCookie(app);
    expect(
      (await app.inject({ method: "POST", url: "/account/password", headers: { cookie }, payload: { currentPassword: "wrong", newPassword: "new-good-password" } })).statusCode,
    ).toBe(401);
    expect(
      (await app.inject({ method: "POST", url: "/account/password", headers: { cookie }, payload: { currentPassword: PASSWORD, newPassword: "new-good-password" } })).statusCode,
    ).toBe(200);
    expect((await app.inject({ method: "POST", url: "/auth/login", payload: { username: USER, password: "new-good-password" } })).statusCode).toBe(200);
    await app.close();
  });

  it("invalidates the session of a deleted user", async () => {
    const app = await makeApp();
    const cookie = await setupAndCookie(app); // alice
    await app.inject({ method: "POST", url: "/users", headers: { cookie }, payload: { username: "bob", password: PASSWORD } });
    const list = (await app.inject({ method: "GET", url: "/users", headers: { cookie } })).json() as { id: string; username: string }[];
    const aliceId = list.find((u) => u.username === USER)!.id;
    await app.inject({ method: "DELETE", url: `/users/${aliceId}`, headers: { cookie } });
    expect((await app.inject({ method: "GET", url: "/auth/me", headers: { cookie } })).statusCode).toBe(401);
    await app.close();
  });
});

// Issue 78: /auth/login is the only endpoint reachable without a session, and it verifies a
// bcrypt hash synchronously, so an unlimited one freezes the event loop long before it leaks
// the password. The budget is per client and per window, never a permanent lockout.
describe("server rate limiting (issue 78)", () => {
  const login = (app: FastifyInstance, password: string) =>
    app.inject({ method: "POST", url: "/auth/login", payload: { username: USER, password } });

  it("answers 429 once the password attempts run out, and says when to retry", async () => {
    const app = await makeApp();
    await setupAndCookie(app);
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) codes.push((await login(app, "wrong password")).statusCode);
    expect(codes.slice(0, 10)).toEqual(Array(10).fill(401)); // the budget: ten attempts
    expect(codes.slice(10)).toEqual([429, 429]); // then the door closes
    const last = await login(app, "wrong password");
    expect(last.statusCode).toBe(429);
    expect(last.headers["retry-after"]).toBeDefined(); // a window, not a lockout
    await app.close();
  });

  it("spends the budget on attempts, so a correct password inside it still works", async () => {
    const app = await makeApp();
    await setupAndCookie(app);
    for (let i = 0; i < 3; i++) expect((await login(app, "nope")).statusCode).toBe(401);
    const good = await login(app, PASSWORD);
    expect(good.statusCode).toBe(200);
    await app.close();
  });

  it("never throttles image requests, however many a book fires at once", async () => {
    const app = await makeApp();
    const cookie = await setupAndCookie(app);
    const id = "44444444-4444-4444-8444-444444444444";
    await app.inject({ method: "PUT", url: `/images/${id}`, headers: { cookie, "content-type": "image/png" }, payload: Buffer.from([1, 2, 3]) });
    // Far past the global budget: opening a large album is exactly this burst.
    const codes = new Set<number>();
    for (let i = 0; i < 650; i++) {
      codes.add((await app.inject({ method: "GET", url: `/images/${id}`, headers: { cookie } })).statusCode);
    }
    expect([...codes]).toEqual([200]);
    await app.close();
  });

  it("keeps a budget on the other routes", async () => {
    const app = await makeApp();
    const cookie = await setupAndCookie(app);
    let throttled = false;
    for (let i = 0; i < 620 && !throttled; i++) {
      const r = await app.inject({ method: "GET", url: "/projects", headers: { cookie } });
      throttled = r.statusCode === 429;
    }
    expect(throttled).toBe(true);
    await app.close();
  });
});

describe("server projects / images / version / update", () => {
  it("does project CRUD when authed", async () => {
    const app = await makeApp();
    const cookie = await setupAndCookie(app);
    const id = "11111111-1111-4111-8111-111111111111";
    expect((await app.inject({ method: "POST", url: "/projects", headers: { cookie }, payload: doc(id) })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/projects", headers: { cookie } })).json()).toHaveLength(1);
    expect((await app.inject({ method: "GET", url: `/projects/${id}`, headers: { cookie } })).json().name).toBe("Trip");
    await app.inject({ method: "PUT", url: `/projects/${id}`, headers: { cookie }, payload: doc(id, "Trip 2") });
    expect((await app.inject({ method: "GET", url: `/projects/${id}`, headers: { cookie } })).json().name).toBe("Trip 2");
    await app.inject({ method: "DELETE", url: `/projects/${id}`, headers: { cookie } });
    expect((await app.inject({ method: "GET", url: `/projects/${id}`, headers: { cookie } })).statusCode).toBe(404);
    await app.close();
  });

  it("round-trips an image with its mime", async () => {
    const app = await makeApp();
    const cookie = await setupAndCookie(app);
    const id = "22222222-2222-4222-8222-222222222222";
    const bytes = Buffer.from([1, 2, 3, 4, 5, 255, 0, 128]);
    const put = await app.inject({ method: "PUT", url: `/images/${id}`, headers: { cookie, "content-type": "image/png" }, payload: bytes });
    expect(put.statusCode).toBe(200);
    const got = await app.inject({ method: "GET", url: `/images/${id}`, headers: { cookie } });
    expect(got.statusCode).toBe(200);
    expect(got.headers["content-type"]).toContain("image/png");
    expect(Buffer.from(got.rawPayload)).toEqual(bytes);
    await app.close();
  });

  it("deletes an image, and stays ok on an id that is already gone", async () => {
    const app = await makeApp();
    const cookie = await setupAndCookie(app);
    const id = "33333333-3333-4333-8333-333333333333";
    const bytes = Buffer.from([9, 8, 7]);
    await app.inject({ method: "PUT", url: `/images/${id}`, headers: { cookie, "content-type": "image/png" }, payload: bytes });
    const del = await app.inject({ method: "DELETE", url: `/images/${id}`, headers: { cookie } });
    expect(del.statusCode).toBe(200);
    const got = await app.inject({ method: "GET", url: `/images/${id}`, headers: { cookie } });
    expect(got.statusCode).toBe(404);
    const again = await app.inject({ method: "DELETE", url: `/images/${id}`, headers: { cookie } });
    expect(again.statusCode).toBe(200);
    await app.close();
  });

  it("rejects a delete with an unsafe image id", async () => {
    const app = await makeApp();
    const cookie = await setupAndCookie(app);
    const bad = await app.inject({ method: "DELETE", url: "/images/..%2Fescape", headers: { cookie } });
    expect(bad.statusCode).toBe(400);
    await app.close();
  });

  it("refuses to build a blob path from an unsafe id, whoever calls", () => {
    // Defense in depth for the js/path-injection class: the routes reject unsafe ids, but the
    // guard lives next to the join, so a future caller cannot escape the blob directory either.
    const store = new Store(":memory:", mkdtempSync(join(tmpdir(), "pp-blob-")));
    expect(() => store.putImage("../escape", Buffer.from([1]), "image/png")).toThrow(/unsafe image id/);
    expect(() => store.getImage("../escape")).toThrow(/unsafe image id/);
    // deleteImage swallows it: deleting a project walks its stored photo ids and must not
    // throw on a corrupt one, it just leaves the bytes behind.
    expect(() => store.deleteImage("../escape")).not.toThrow();
  });

  it("reports version info, gated", async () => {
    clearVersionCache();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ tag_name: "v99.0.0" }) })));
    const app = await makeApp();
    expect((await app.inject({ method: "GET", url: "/version" })).statusCode).toBe(401);
    const cookie = await setupAndCookie(app);
    const res = await app.inject({ method: "GET", url: "/version", headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json().latest).toBe("99.0.0");
    await app.close();
    vi.unstubAllGlobals();
  });

  it("refuses one-click update without the Docker socket", async () => {
    const app = await makeApp();
    const cookie = await setupAndCookie(app);
    const res = await app.inject({ method: "POST", url: "/update", headers: { cookie } });
    expect(res.statusCode).toBe(409);
    expect(res.json().manualCommand).toContain("docker compose pull");
    await app.close();
  });
});

afterEach(() => vi.unstubAllGlobals());
