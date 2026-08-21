import { describe, it, expect, beforeEach } from "vitest";
import {
  readUpdateLock,
  writeUpdateLock,
  clearUpdateLock,
  isLockActive,
  UPDATE_LOCK_KEY,
  UPDATE_TIMEOUT_MS,
  type UpdateLock,
} from "./update-lock";

// Minimal in-memory localStorage (tests run in node, which has none). Only the methods the
// module uses are implemented.
class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage();
});

describe("update-lock persistence", () => {
  it("round-trips a lock through storage", () => {
    const lock: UpdateLock = { target: "0.3.0", startedAt: 1000 };
    writeUpdateLock(lock);
    expect(localStorage.getItem(UPDATE_LOCK_KEY)).toContain("0.3.0");
    expect(readUpdateLock()).toEqual(lock);
  });

  it("returns null when nothing is stored", () => {
    expect(readUpdateLock()).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    localStorage.setItem(UPDATE_LOCK_KEY, "{not json");
    expect(readUpdateLock()).toBeNull();
  });

  it("returns null for a wrong-shaped object", () => {
    localStorage.setItem(UPDATE_LOCK_KEY, JSON.stringify({ target: 5 }));
    expect(readUpdateLock()).toBeNull();
  });

  it("clears the lock", () => {
    writeUpdateLock({ target: "0.3.0", startedAt: 1000 });
    clearUpdateLock();
    expect(readUpdateLock()).toBeNull();
  });
});

describe("isLockActive", () => {
  const base: UpdateLock = { target: "0.3.0", startedAt: 1000 };

  it("is active within the safety window", () => {
    expect(isLockActive(base, 1000 + UPDATE_TIMEOUT_MS - 1)).toBe(true);
  });

  it("is inactive once the timeout elapses", () => {
    expect(isLockActive(base, 1000 + UPDATE_TIMEOUT_MS + 1)).toBe(false);
  });

  it("is inactive when failed", () => {
    expect(isLockActive({ ...base, failed: true }, 1000)).toBe(false);
  });

  it("is inactive for a null lock", () => {
    expect(isLockActive(null, 1000)).toBe(false);
  });
});
