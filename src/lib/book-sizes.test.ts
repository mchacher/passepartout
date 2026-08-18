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

  it("computes the ratio of each orientation", () => {
    expect(ratioOf(bookSizeOrDefault("blurb-square-7"))).toBeCloseTo(1, 6);
    expect(ratioOf(bookSizeOrDefault("blurb-portrait-8x10"))).toBeCloseTo(0.8, 6);
    expect(ratioOf(bookSizeOrDefault("blurb-landscape-10x8"))).toBeCloseTo(1.25, 6);
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
