import { describe, it, expect } from "vitest";
import { effectiveRatio, clampCrop, moveCropRect, resizeCropRect, cropImgBox, MIN_CROP } from "./crop";
import type { CropRect } from "../types";

const full: CropRect = { x: 0, y: 0, w: 1, h: 1 };

describe("effectiveRatio", () => {
  it("is the source ratio when there is no crop or a full crop", () => {
    expect(effectiveRatio(1.5)).toBe(1.5);
    expect(effectiveRatio(1.5, full)).toBe(1.5);
  });
  it("scales by the kept aspect factor", () => {
    // keep left half of a 2:1 photo -> region is 1:1 -> effective ratio 1
    expect(effectiveRatio(2, { x: 0, y: 0, w: 0.5, h: 1 })).toBeCloseTo(1, 6);
    // keep top half -> region is 4:1
    expect(effectiveRatio(2, { x: 0, y: 0, w: 1, h: 0.5 })).toBeCloseTo(4, 6);
  });
});

describe("clampCrop", () => {
  it("pulls a rect inside [0,1] and enforces the minimum size", () => {
    expect(clampCrop({ x: -0.2, y: 0.9, w: 1.5, h: 0.01 })).toEqual({
      x: 0,
      y: 0.9, // within [0, 1 - MIN_CROP]
      w: 1,
      h: MIN_CROP,
    });
  });
  it("keeps x+w and y+h within the image", () => {
    const c = clampCrop({ x: 0.8, y: 0.8, w: 0.5, h: 0.5 });
    expect(c.x + c.w).toBeLessThanOrEqual(1 + 1e-9);
    expect(c.y + c.h).toBeLessThanOrEqual(1 + 1e-9);
  });
});

describe("moveCropRect", () => {
  it("translates and clamps to the image", () => {
    const m = moveCropRect({ x: 0.2, y: 0.2, w: 0.4, h: 0.4 }, 0.1, -0.1);
    expect(m.x).toBeCloseTo(0.3, 6);
    expect(m.y).toBeCloseTo(0.1, 6);
    const capped = moveCropRect({ x: 0.2, y: 0.2, w: 0.4, h: 0.4 }, 1, 1);
    expect(capped.x).toBeCloseTo(0.6, 6);
    expect(capped.y).toBeCloseTo(0.6, 6);
  });
});

describe("resizeCropRect", () => {
  it("grows from the bottom-right corner, top-left fixed", () => {
    const r = resizeCropRect({ x: 0.2, y: 0.2, w: 0.3, h: 0.3 }, "br", 0.2, 0.1);
    expect(r).toMatchObject({ x: 0.2, y: 0.2 });
    expect(r.w).toBeCloseTo(0.5, 6);
    expect(r.h).toBeCloseTo(0.4, 6);
  });
  it("moves the left edge only (top-left handle keeps the right/bottom)", () => {
    const r = resizeCropRect({ x: 0.4, y: 0.4, w: 0.4, h: 0.4 }, "l", -0.2, 0.5);
    expect(r.x).toBeCloseTo(0.2, 6);
    expect(r.w).toBeCloseTo(0.6, 6);
    expect(r.y).toBe(0.4); // unchanged: "l" touches only x
  });
  it("never shrinks below the minimum and stays in-bounds", () => {
    const r = resizeCropRect({ x: 0.2, y: 0.2, w: 0.4, h: 0.4 }, "br", -1, -1);
    expect(r.w).toBeCloseTo(MIN_CROP, 6);
    expect(r.h).toBeCloseTo(MIN_CROP, 6);
    const big = resizeCropRect({ x: 0.8, y: 0.8, w: 0.15, h: 0.15 }, "br", 1, 1);
    expect(big.x + big.w).toBeLessThanOrEqual(1 + 1e-9);
    expect(big.y + big.h).toBeLessThanOrEqual(1 + 1e-9);
  });
});

describe("cropImgBox", () => {
  it("renders a full crop as the plain image (image == box, no offset)", () => {
    expect(cropImgBox(full, 300, 200)).toEqual({ w: 300, h: 200, ox: 0, oy: 0 });
    expect(cropImgBox(undefined, 300, 200)).toEqual({ w: 300, h: 200, ox: 0, oy: 0 });
  });
  it("scales and offsets so the crop rect fills the box", () => {
    // keep the right half: image is twice as wide as the box, shifted left by half its width
    const b = cropImgBox({ x: 0.5, y: 0, w: 0.5, h: 1 }, 300, 200);
    expect(b.w).toBeCloseTo(600, 6);
    expect(b.h).toBeCloseTo(200, 6);
    expect(b.ox).toBeCloseTo(-300, 6); // -0.5 * 600
    expect(b.oy).toBeCloseTo(0, 6);
  });
});
