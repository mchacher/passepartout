import { describe, it, expect } from "vitest";
import {
  FRAMES,
  FRAME_COLORS,
  frameById,
  isFrame,
  frameColorOf,
  frameInner,
  frameLayoutRatio,
  squareCrop,
  photoLayoutRatio,
  borderWidthOf,
  POLAROID_RATIO,
  DEFAULT_BORDER_WIDTH,
} from "./frames";

const polaroid = FRAMES.find((f) => f.id === "polaroid")!;
const border = FRAMES.find((f) => f.id === "border")!;

describe("frame catalog", () => {
  it("has unique, well-formed styles and colors", () => {
    expect(new Set(FRAMES.map((f) => f.id)).size).toBe(FRAMES.length);
    expect(polaroid.square).toBe(true);
    expect(polaroid.hasText).toBe(true);
    expect(border.square).toBe(false);
    expect(new Set(FRAME_COLORS.map((c) => c.id)).size).toBe(FRAME_COLORS.length);
    for (const c of FRAME_COLORS) {
      expect(c.value).toMatch(/^#/);
      expect(c.ink).toMatch(/^#/);
    }
  });

  it("frameById / isFrame / frameColorOf validate ids", () => {
    expect(frameById("polaroid")).toEqual(polaroid);
    expect(frameById("nope")).toBeUndefined();
    expect(isFrame("border")).toBe(true);
    expect(isFrame("nope")).toBe(false);
    expect(frameColorOf("kraft", "white").id).toBe("kraft");
    expect(frameColorOf("nope", "white").id).toBe("white");
  });

  it("borderWidthOf clamps and defaults", () => {
    expect(borderWidthOf(undefined)).toBe(DEFAULT_BORDER_WIDTH);
    expect(borderWidthOf(NaN)).toBe(DEFAULT_BORDER_WIDTH);
    expect(borderWidthOf(0.04)).toBe(0.04);
    expect(borderWidthOf(9)).toBeLessThanOrEqual(0.12);
    expect(borderWidthOf(0)).toBeGreaterThan(0);
  });
});

describe("frameInner", () => {
  it("gives the Polaroid a square window inside the box, above a thick bottom band", () => {
    const w = 400, h = Math.round(400 / POLAROID_RATIO);
    const inner = frameInner(polaroid, w, h, DEFAULT_BORDER_WIDTH);
    expect(inner.w).toBeCloseTo(inner.h, 3); // square window
    expect(inner.x).toBeGreaterThan(0);
    expect(inner.x + inner.w).toBeLessThanOrEqual(w + 1e-6);
    const bottomBand = h - (inner.y + inner.h);
    expect(bottomBand).toBeGreaterThan(inner.y); // bottom thicker than top
  });

  it("insets the Border by a uniform selectable width", () => {
    const thin = frameInner(border, 400, 300, 0.02);
    const thick = frameInner(border, 400, 300, 0.08);
    expect(thin.x).toBeCloseTo(0.02 * 400, 6);
    expect(thick.x).toBeGreaterThan(thin.x); // wider border, smaller window
    expect(thin.w).toBeGreaterThan(thick.w);
  });
});

describe("frameLayoutRatio", () => {
  it("is fixed for the Polaroid regardless of the photo ratio", () => {
    expect(frameLayoutRatio(polaroid, 1.5, DEFAULT_BORDER_WIDTH)).toBe(POLAROID_RATIO);
    expect(frameLayoutRatio(polaroid, 0.6, DEFAULT_BORDER_WIDTH)).toBe(POLAROID_RATIO);
  });

  it("for the Border, lets the photo fill the inner area (uniform border, no letterbox)", () => {
    const r = 1.5, bw = 0.04;
    const outer = frameLayoutRatio(border, r, bw);
    // Inner box (outer inset by bw each side) must have the photo's ratio.
    const innerW = 1 - 2 * bw;
    const innerH = 1 / outer - 2 * bw;
    expect(innerW / innerH).toBeCloseTo(r, 5);
  });
});

describe("squareCrop", () => {
  it("keeps a pixel-square region and pans the overflowing axis", () => {
    const land = squareCrop(2, { x: 1, y: 0.5 }); // landscape: pans x
    expect(land.h).toBe(1);
    expect(land.w).toBeCloseTo(0.5, 6);
    expect(land.x).toBeCloseTo(0.5, 6); // focus.x=1 -> pushed right
    const port = squareCrop(0.5, { x: 0.5, y: 0 }); // portrait: pans y
    expect(port.w).toBe(1);
    expect(port.h).toBeCloseTo(0.5, 6);
    expect(port.y).toBeCloseTo(0, 6);
  });
});

describe("photoLayoutRatio", () => {
  it("is the effective ratio without a frame and the Polaroid ratio with one", () => {
    expect(photoLayoutRatio({ ratio: 1.5 })).toBeCloseTo(1.5, 6);
    expect(photoLayoutRatio({ ratio: 1.5, frame: "polaroid" })).toBe(POLAROID_RATIO);
    expect(photoLayoutRatio({ ratio: 1.5, frame: "nope" })).toBeCloseTo(1.5, 6); // unknown -> no frame
  });
});
