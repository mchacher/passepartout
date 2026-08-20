import { describe, it, expect } from "vitest";
import { clampZoom, zoomedWidthPx, fitWidthPx, FIT_MARGIN, ZOOM_MIN, ZOOM_MAX, ZOOM_DEFAULT } from "./zoom";

describe("clampZoom", () => {
  it("returns an in-range zoom unchanged", () => {
    expect(clampZoom(0.7)).toBe(0.7);
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

describe("fitWidthPx", () => {
  it("leaves a fit margin at 100% (does not touch the edges)", () => {
    expect(fitWidthPx(1000)).toBe(Math.round(1000 * (1 - FIT_MARGIN)));
    expect(fitWidthPx(1000)).toBeLessThan(1000);
  });

  it("treats a missing or invalid content width as zero", () => {
    expect(fitWidthPx(0)).toBe(0);
    expect(fitWidthPx(NaN)).toBe(0);
    expect(fitWidthPx(-50)).toBe(0);
  });
});

describe("zoomedWidthPx", () => {
  it("fills the fit width at 100% (fit)", () => {
    expect(zoomedWidthPx(1200, 1)).toBe(1200);
  });

  it("is a fraction of the available width below 100%", () => {
    expect(zoomedWidthPx(1200, 0.5)).toBe(600);
  });

  it("never exceeds the available width (grows monotonically, capped at fit)", () => {
    expect(zoomedWidthPx(1000, ZOOM_MAX)).toBeGreaterThan(zoomedWidthPx(1000, ZOOM_MIN));
    expect(zoomedWidthPx(1000, ZOOM_MAX)).toBe(1000);
  });

  it("clamps an out-of-range zoom before scaling", () => {
    expect(zoomedWidthPx(1000, 99)).toBe(zoomedWidthPx(1000, ZOOM_MAX));
    expect(zoomedWidthPx(1000, 0)).toBe(zoomedWidthPx(1000, ZOOM_MIN));
  });

  it("treats a missing or invalid available width as zero", () => {
    expect(zoomedWidthPx(0, 1)).toBe(0);
    expect(zoomedWidthPx(NaN, 1)).toBe(0);
    expect(zoomedWidthPx(-50, 1)).toBe(0);
  });
});
