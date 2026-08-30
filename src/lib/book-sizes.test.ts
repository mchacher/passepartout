import { describe, it, expect } from "vitest";
import {
  BOOK_SIZES,
  DEFAULT_BOOK_SIZE,
  bookSizeForLegacyFormat,
  bookSizeOrDefault,
  ratioOf,
} from "./book-sizes";

describe("book-sizes catalog", () => {
  it("has five sizes with unique ids and positive dimensions", () => {
    const ids = BOOK_SIZES.map((s) => s.id);
    expect(BOOK_SIZES).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
    for (const s of BOOK_SIZES) {
      expect(s.widthMm).toBeGreaterThan(0);
      expect(s.heightMm).toBeGreaterThan(0);
      expect(s.name.length).toBeGreaterThan(0);
    }
  });

  it("resolves the default id to a size in the catalog", () => {
    expect(BOOK_SIZES.some((s) => s.id === DEFAULT_BOOK_SIZE)).toBe(true);
  });

  // The ratios come from Blurb's REAL trims, not its marketing names (spec 041): a "7x7
  // Small Square" is really 6.75 x 6.625 in, so it is not quite square, and a "10x8" is
  // 9.5 x 8.0 in. Asserting 1 and 1.25 here is what let issue #114 ship.
  it("computes the ratio of each size from its real trim", () => {
    expect(ratioOf(bookSizeOrDefault("blurb-square-7"))).toBeCloseTo(6.75 / 6.625, 6);
    expect(ratioOf(bookSizeOrDefault("blurb-portrait-8x10"))).toBeCloseTo(0.8, 6);
    expect(ratioOf(bookSizeOrDefault("blurb-landscape-10x8"))).toBeCloseTo(9.5 / 8, 6);
  });

  it("uses the trims Blurb's spec calculator reports, in millimetres", () => {
    const mm = (inches: number) => inches * 25.4;
    expect(bookSizeOrDefault("blurb-landscape-10x8").widthMm).toBeCloseTo(mm(9.5), 6);
    expect(bookSizeOrDefault("blurb-landscape-10x8").heightMm).toBeCloseTo(mm(8), 6);
    expect(bookSizeOrDefault("blurb-portrait-8x10").widthMm).toBeCloseTo(mm(8), 6);
    expect(bookSizeOrDefault("blurb-square-12").widthMm).toBeCloseTo(mm(11.75), 6);
  });
});

describe("bookSizeOrDefault", () => {
  it("returns the matching size for a valid id", () => {
    expect(bookSizeOrDefault("blurb-portrait-8x10").id).toBe("blurb-portrait-8x10");
  });

  it("falls back to the default for an unknown or missing id", () => {
    expect(bookSizeOrDefault("nope").id).toBe(DEFAULT_BOOK_SIZE);
    expect(bookSizeOrDefault(undefined).id).toBe(DEFAULT_BOOK_SIZE);
    expect(bookSizeOrDefault(null).id).toBe(DEFAULT_BOOK_SIZE);
  });
});

describe("bookSizeForLegacyFormat", () => {
  it("maps each legacy format to a Blurb size", () => {
    expect(bookSizeForLegacyFormat("square")).toBe("blurb-square-7");
    expect(bookSizeForLegacyFormat("portrait")).toBe("blurb-portrait-8x10");
    expect(bookSizeForLegacyFormat("landscape")).toBe("blurb-landscape-10x8");
    expect(bookSizeForLegacyFormat(undefined)).toBe("blurb-square-7");
  });
});
