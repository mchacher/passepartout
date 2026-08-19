import { describe, it, expect } from "vitest";
import { coverSourceRect } from "./fit";

// A 2000 x 1000 source (ratio 2, a wide panorama) and a 1000 x 2000 source (ratio 0.5,
// a portrait) exercise both overflow axes.
const WIDE = { w: 2000, h: 1000 };
const TALL = { w: 1000, h: 2000 };

describe("coverSourceRect", () => {
  it("crops the width of a wide source to a square target, centered by default", () => {
    const r = coverSourceRect(WIDE.w, WIDE.h, 1);
    expect(r.sw / r.sh).toBeCloseTo(1, 6); // rect matches the target aspect
    expect(r.sh).toBe(WIDE.h); // full height kept
    expect(r.sw).toBe(1000);
    expect(r.sx).toBe(500); // centered: (2000 - 1000) / 2
    expect(r.sy).toBe(0);
  });

  it("crops the height of a tall source to a landscape target, centered by default", () => {
    const r = coverSourceRect(TALL.w, TALL.h, 2); // target wider than tall
    expect(r.sw / r.sh).toBeCloseTo(2, 6);
    expect(r.sw).toBe(TALL.w); // full width kept
    expect(r.sh).toBe(500);
    expect(r.sy).toBe(750); // centered: (2000 - 500) / 2
    expect(r.sx).toBe(0);
  });

  it("keeps the whole source when its ratio already matches the target", () => {
    const r = coverSourceRect(WIDE.w, WIDE.h, 2);
    expect(r).toEqual({ sx: 0, sy: 0, sw: 2000, sh: 1000 });
  });

  it("pins the crop to the left / right edge for focus x = 0 / 1 on a wide source", () => {
    const left = coverSourceRect(WIDE.w, WIDE.h, 1, { x: 0, y: 0.5 });
    expect(left.sx).toBe(0);
    const right = coverSourceRect(WIDE.w, WIDE.h, 1, { x: 1, y: 0.5 });
    expect(right.sx + right.sw).toBe(WIDE.w);
  });

  it("pins the crop to the top / bottom edge for focus y = 0 / 1 on a tall source", () => {
    const top = coverSourceRect(TALL.w, TALL.h, 2, { x: 0.5, y: 0 });
    expect(top.sy).toBe(0);
    const bottom = coverSourceRect(TALL.w, TALL.h, 2, { x: 0.5, y: 1 });
    expect(bottom.sy + bottom.sh).toBe(TALL.h);
  });

  it("clamps an out-of-range focus and stays inside the source", () => {
    const r = coverSourceRect(WIDE.w, WIDE.h, 1, { x: 2, y: -1 });
    expect(r.sx).toBe(WIDE.w - r.sw); // x=2 clamps to 1 -> right edge
    expect(r.sx).toBeGreaterThanOrEqual(0);
    expect(r.sx + r.sw).toBeLessThanOrEqual(WIDE.w);
  });

  it("never exceeds the source bounds for a range of ratios and focuses", () => {
    for (const target of [0.3, 0.75, 1, 1.5, 3]) {
      for (const f of [0, 0.25, 0.5, 0.9, 1]) {
        const r = coverSourceRect(WIDE.w, WIDE.h, target, { x: f, y: f });
        expect(r.sx).toBeGreaterThanOrEqual(0);
        expect(r.sy).toBeGreaterThanOrEqual(0);
        expect(r.sx + r.sw).toBeLessThanOrEqual(WIDE.w + 1e-9);
        expect(r.sy + r.sh).toBeLessThanOrEqual(WIDE.h + 1e-9);
        expect(r.sw / r.sh).toBeCloseTo(target, 6); // proportional: matches target aspect
      }
    }
  });
});
