import { describe, it, expect } from "vitest";
import { canArrange } from "./arrange";

describe("canArrange", () => {
  it("allows a page whose every slot holds a photo", () => {
    expect(canArrange(3, 3, false)).toBe(true);
    expect(canArrange(1, 1, false)).toBe(true);
  });

  it("refuses a page with an empty slot left, since a cell with no photo cannot be arranged", () => {
    expect(canArrange(2, 3, false)).toBe(false);
  });

  it("refuses an empty page", () => {
    expect(canArrange(0, 3, false)).toBe(false);
    expect(canArrange(0, 0, false)).toBe(false);
  });

  it("refuses a full-page photo, which owns the page and has no cells", () => {
    expect(canArrange(1, 1, true)).toBe(false);
  });
});
