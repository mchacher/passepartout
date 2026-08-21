import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isNewer, parseVersion, fetchLatest, clearVersionCache } from "./version";

describe("version compare", () => {
  it("parses plain and v-prefixed semver", () => {
    expect(parseVersion("v1.2.3")).toEqual([1, 2, 3]);
    expect(parseVersion("1.2.3")).toEqual([1, 2, 3]);
    expect(parseVersion("nope")).toBeNull();
  });

  it("isNewer compares correctly", () => {
    expect(isNewer("1.0.0", "1.0.1")).toBe(true);
    expect(isNewer("1.0.0", "1.1.0")).toBe(true);
    expect(isNewer("1.2.0", "1.1.9")).toBe(false);
    expect(isNewer("1.0.0", "1.0.0")).toBe(false);
    expect(isNewer("1.0.0", "garbage")).toBe(false);
  });
});

describe("fetchLatest", () => {
  beforeEach(() => clearVersionCache());
  afterEach(() => vi.unstubAllGlobals());

  it("returns the tag (v stripped) with a token", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ tag_name: "v0.3.0" }) })));
    expect(await fetchLatest("tok")).toBe("0.3.0");
  });

  it("returns null when the request is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })));
    expect(await fetchLatest(undefined)).toBeNull();
  });

  it("returns null and does not throw on a network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network");
      }),
    );
    expect(await fetchLatest("tok")).toBeNull();
  });

  it("caches within the window (one request)", async () => {
    const f = vi.fn(async () => ({ ok: true, json: async () => ({ tag_name: "1.0.0" }) }));
    vi.stubGlobal("fetch", f);
    await fetchLatest("t");
    await fetchLatest("t");
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("force bypasses the cache (spec 027)", async () => {
    const f = vi.fn(async () => ({ ok: true, json: async () => ({ tag_name: "1.0.0" }) }));
    vi.stubGlobal("fetch", f);
    await fetchLatest("t"); // caches
    await fetchLatest("t"); // cached -> still 1
    await fetchLatest("t", { force: true }); // re-fetch
    expect(f).toHaveBeenCalledTimes(2);
  });
});
