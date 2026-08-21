import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { initBackend } from "./persistence";

// Drive the remote backend with a mocked fetch: /api/health responds, so initBackend selects
// remote mode, and we assert the adapter builds the right requests (spec 024).

interface Call {
  url: string;
  method: string;
  body?: string;
}

const calls: Call[] = [];

function ok(body: unknown): Response {
  return { ok: true, status: 200, json: () => Promise.resolve(body), blob: () => Promise.resolve(new Blob()) } as Response;
}

beforeEach(() => {
  calls.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? "GET", body: init?.body as string | undefined });
      if (url.endsWith("/api/health")) return Promise.resolve(ok({ status: "ok" }));
      if (url.endsWith("/api/version")) {
        return Promise.resolve(ok({ current: "0.1.0", latest: "0.2.0", updateAvailable: true, canApply: false }));
      }
      if (url.endsWith("/api/projects") && (init?.method ?? "GET") === "GET") {
        return Promise.resolve(ok([{ id: "a", name: "A", createdAt: 1, updatedAt: 2 }]));
      }
      return Promise.resolve(ok({ ok: true }));
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("remote backend", () => {
  it("selects remote mode when /api/health responds", async () => {
    const backend = await initBackend();
    expect(backend.mode).toBe("remote");
    expect(backend.persistent).toBe(true);
  });

  it("lists projects via GET /api/projects", async () => {
    const backend = await initBackend();
    const list = await backend.listProjects();
    expect(list).toEqual([{ id: "a", name: "A", createdAt: 1, updatedAt: 2 }]);
    expect(calls.some((c) => c.url.endsWith("/api/projects") && c.method === "GET")).toBe(true);
  });

  it("saves a project doc via PUT /api/projects/:id", async () => {
    const backend = await initBackend();
    // A minimal doc; the adapter only serializes it.
    await backend.saveProjectDoc({ id: "p1", name: "N" } as never);
    const put = calls.find((c) => c.url.endsWith("/api/projects/p1"));
    expect(put?.method).toBe("PUT");
    expect(JSON.parse(put!.body as string)).toMatchObject({ id: "p1", name: "N" });
  });

  it("returns /api/images URLs without hitting the network", async () => {
    const backend = await initBackend();
    const before = calls.length;
    const urls = await backend.imageUrls(["x", "y"]);
    expect(urls.get("x")).toBe("/api/images/x");
    expect(urls.get("y")).toBe("/api/images/y");
    expect(calls.length).toBe(before); // no fetch for URL resolution
  });

  it("posts credentials on login (spec 026)", async () => {
    const backend = await initBackend();
    const res = await backend.login("alice", "secret");
    expect(res.ok).toBe(true);
    const login = calls.find((c) => c.url.endsWith("/api/auth/login"));
    expect(login?.method).toBe("POST");
    expect(JSON.parse(login!.body as string)).toEqual({ username: "alice", password: "secret" });
  });

  it("reads version info from /api/version", async () => {
    const backend = await initBackend();
    const v = await backend.version();
    expect(v.updateAvailable).toBe(true);
    expect(v.latest).toBe("0.2.0");
  });

  it("posts to /api/update on applyUpdate", async () => {
    const backend = await initBackend();
    const res = await backend.applyUpdate();
    expect(res.started).toBe(true);
    expect(calls.some((c) => c.url.endsWith("/api/update") && c.method === "POST")).toBe(true);
  });
});
