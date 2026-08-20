import { describe, it, expect } from "vitest";
import { MASKS, maskById, isMask } from "./masks";

describe("mask catalog", () => {
  it("has unique, non-empty ids and paths", () => {
    const ids = MASKS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of MASKS) {
      expect(m.id).not.toBe("");
      expect(m.name).not.toBe("");
      expect(m.path.trim().length).toBeGreaterThan(0);
      expect(m.path).toMatch(/^M/); // a path starts with a moveto
    }
  });

  it("maskById returns a known shape and nothing for unknown / absent ids", () => {
    expect(maskById("oval")).toEqual(MASKS.find((m) => m.id === "oval"));
    expect(maskById("nope")).toBeUndefined();
    expect(maskById(undefined)).toBeUndefined();
  });

  it("isMask validates catalog ids", () => {
    expect(isMask("oval")).toBe(true);
    expect(isMask("nope")).toBe(false);
    expect(isMask(undefined)).toBe(false);
  });
});
