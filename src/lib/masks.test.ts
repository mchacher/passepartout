import { describe, it, expect } from "vitest";
import { MASKS, maskById, isMask, maskClipValue } from "./masks";

describe("mask catalog", () => {
  it("has unique, non-empty ids and names", () => {
    const ids = MASKS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of MASKS) {
      expect(m.id).not.toBe("");
      expect(m.name).not.toBe("");
    }
  });

  it("every mask carries exactly one clip mechanism (path or css clip)", () => {
    for (const m of MASKS) {
      const hasPath = typeof m.path === "string" && m.path.trim().length > 0;
      const hasClip = typeof m.clip === "string" && m.clip.trim().length > 0;
      expect(hasPath !== hasClip, `mask ${m.id} must have exactly one of path/clip`).toBe(true);
      if (hasPath) expect(m.path).toMatch(/^M/); // a path starts with a moveto
    }
  });

  it("ships a true circle (css clip) and an ellipse (svg path)", () => {
    expect(maskById("circle")?.clip).toBe("circle(closest-side)");
    expect(maskById("oval")?.path).toMatch(/^M/);
  });

  it("offers three rounded sizes with increasing corner radius", () => {
    const ids = MASKS.map((m) => m.id);
    for (const id of ["rounded-sm", "rounded", "rounded-lg"]) expect(ids).toContain(id);
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

  it("maskClipValue resolves a css clip, an svg reference, or nothing", () => {
    expect(maskClipValue("circle")).toBe("circle(closest-side)");
    expect(maskClipValue("oval")).toBe("url(#pp-mask-oval)");
    expect(maskClipValue("rounded")).toBe("url(#pp-mask-rounded)");
    expect(maskClipValue("nope")).toBeUndefined();
    expect(maskClipValue(undefined)).toBeUndefined();
  });
});
