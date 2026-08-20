import { describe, it, expect } from "vitest";
import { clampZoom, zoomWidthPx, ZOOM_MIN, ZOOM_MAX, ZOOM_DEFAULT, BASE_WIDTH_PX } from "./zoom";

describe("clampZoom", () => {
  it("returns an in-range zoom unchanged", () => {
    expect(clampZoom(1.2)).toBe(1.2);
    expect(clampZoom(ZOOM_MIN)).toBe(ZOOM_MIN);
    expect(clampZoom(ZOOM_MAX)).toBe(ZOOM_MAX);
  });

  it("clamps below the minimum and above the maximum", () => {
    expect(clampZoom(0.1)).toBe(ZOOM_MIN);
    expect(clampZoom(9)).toBe(ZOOM_MAX);
  });

  it("falls back to the default for a non-finite value", () => {
    expect(clampZoom(NaN)).toBe(ZOOM_DEFAULT);
    expect(clampZoom(Infinity)).toBe(ZOOM_DEFAULT);
    expect(clampZoom(-Infinity)).toBe(ZOOM_DEFAULT);
  });
});

describe("zoomWidthPx", () => {
  it("is the base width at 100%", () => {
    expect(zoomWidthPx(1)).toBe(BASE_WIDTH_PX);
  });

  it("grows monotonically with zoom", () => {
    expect(zoomWidthPx(ZOOM_MAX)).toBeGreaterThan(zoomWidthPx(1));
    expect(zoomWidthPx(1)).toBeGreaterThan(zoomWidthPx(ZOOM_MIN));
  });

  it("clamps an out-of-range input before scaling", () => {
    expect(zoomWidthPx(99)).toBe(zoomWidthPx(ZOOM_MAX));
    expect(zoomWidthPx(0)).toBe(zoomWidthPx(ZOOM_MIN));
  });
});
