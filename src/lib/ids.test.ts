import { describe, it, expect, afterEach } from "vitest";
import { newId } from "./ids";

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const realRandomUUID = globalThis.crypto.randomUUID;

/** Simulate an insecure context (plain HTTP on a LAN address), where the browser
 *  does not expose crypto.randomUUID at all. */
function withoutRandomUUID(run: () => void) {
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    value: undefined,
    configurable: true,
    writable: true,
  });
  run();
}

afterEach(() => {
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    value: realRandomUUID,
    configurable: true,
    writable: true,
  });
});

describe("newId", () => {
  it("returns a v4 uuid in a secure context", () => {
    expect(newId()).toMatch(V4);
  });

  it("still returns a v4 uuid when crypto.randomUUID is missing", () => {
    withoutRandomUUID(() => {
      expect(globalThis.crypto.randomUUID).toBeUndefined();
      expect(newId()).toMatch(V4);
    });
  });

  it("does not collide over many calls in the fallback path", () => {
    withoutRandomUUID(() => {
      const ids = new Set(Array.from({ length: 5000 }, () => newId()));
      expect(ids.size).toBe(5000);
    });
  });
});
