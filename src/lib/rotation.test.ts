import { describe, it, expect } from "vitest";
import { clampRotation, ROTATION_MAX } from "./rotation";

describe("clampRotation", () => {
  it("leaves an in-range tilt unchanged", () => {
    expect(clampRotation(10)).toBe(10);
    expect(clampRotation(-25)).toBe(-25);
    expect(clampRotation(0)).toBe(0);
  });

  it("clamps beyond the decorative range", () => {
    expect(clampRotation(90)).toBe(ROTATION_MAX);
    expect(clampRotation(-180)).toBe(-ROTATION_MAX);
  });

  it("is level for a non-finite value", () => {
    expect(clampRotation(NaN)).toBe(0);
    expect(clampRotation(Infinity)).toBe(0);
    expect(clampRotation(-Infinity)).toBe(0);
  });
});
