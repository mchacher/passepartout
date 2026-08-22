import { describe, it, expect } from "vitest";
import { MASKS, maskById, isMask, maskClipValue, ROUNDED_SIZES, roundedRadiusOf, DEFAULT_ROUNDED_SIZE } from "./masks";

describe("mask catalog", () => {
  it("has unique, non-empty ids and names", () => {
    const ids = MASKS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of MASKS) {
      expect(m.id).not.toBe("");
      expect(m.name).not.toBe("");
    }
  });

  it("every mask carries exactly one clip mechanism (path, css clip, or rounded)", () => {
    for (const m of MASKS) {
      const kinds = [m.path, m.clip, m.rounded].filter(Boolean).length;
      expect(kinds, `mask ${m.id} must declare exactly one clip mechanism`).toBe(1);
      if (m.path) expect(m.path).toMatch(/^M/); // a path starts with a moveto
    }
  });

  it("ships circle (css), oval (path), a single parameterized rounded, and arch", () => {
    expect(maskById("circle")?.clip).toBe("circle(closest-side)");
    expect(maskById("oval")?.path).toMatch(/^M/);
    expect(maskById("rounded")?.rounded).toBe(true);
    expect(maskById("arch")?.path).toMatch(/^M/);
    // The old per-size rounded ids are gone (spec 034 collapsed them into one + a size control).
    expect(maskById("rounded-sm")).toBeUndefined();
    expect(maskById("rounded-lg")).toBeUndefined();
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

describe("rounded sizes (spec 034)", () => {
  it("offers three ascending sizes", () => {
    expect(ROUNDED_SIZES).toHaveLength(3);
    const v = ROUNDED_SIZES.map((s) => s.value);
    expect(v[0]).toBeLessThan(v[1]);
    expect(v[1]).toBeLessThan(v[2]);
  });

  it("roundedRadiusOf clamps and defaults", () => {
    expect(roundedRadiusOf(undefined)).toBe(DEFAULT_ROUNDED_SIZE);
    expect(roundedRadiusOf(Number.NaN)).toBe(DEFAULT_ROUNDED_SIZE);
    expect(roundedRadiusOf(0.16)).toBe(0.16);
    expect(roundedRadiusOf(5)).toBe(0.5); // clamped up
    expect(roundedRadiusOf(0)).toBe(0.02); // clamped down
  });
});

describe("maskClipValue", () => {
  it("resolves circle / oval / arch independent of the box", () => {
    expect(maskClipValue("circle", { w: 200, h: 300 })).toBe("circle(closest-side)");
    expect(maskClipValue("oval", { w: 200, h: 300 })).toBe("url(#pp-mask-oval)");
    expect(maskClipValue("arch")).toBe("url(#pp-mask-arch)");
    expect(maskClipValue("nope")).toBeUndefined();
    expect(maskClipValue(undefined)).toBeUndefined();
  });

  it("rounded uses a constant circular radius = fraction of the shorter side", () => {
    expect(maskClipValue("rounded", { w: 200, h: 300, radius: 0.1 })).toBe("inset(0 round 20px)");
  });

  it("rounded gives the SAME radius on a portrait and a landscape of the same shorter side", () => {
    const portrait = maskClipValue("rounded", { w: 200, h: 300, radius: 0.1 });
    const landscape = maskClipValue("rounded", { w: 300, h: 200, radius: 0.1 });
    expect(landscape).toBe(portrait); // does not follow the photo format
  });

  it("rounded falls back to the default size when no radius is given", () => {
    expect(maskClipValue("rounded", { w: 100, h: 100 })).toBe(`inset(0 round ${DEFAULT_ROUNDED_SIZE * 100}px)`);
  });

  it("rounded returns undefined when the box is not measured yet", () => {
    expect(maskClipValue("rounded", { radius: 0.1 })).toBeUndefined();
  });
});
