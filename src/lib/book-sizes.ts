// Physical book sizes (pure catalog), the source of a project's page ratio and, from
// spec 009, its print geometry. Same shape as the other catalogs (themes, text-sizes):
// a small curated set a project picks by id. Dimensions are the real trim sizes of the
// supported print provider (Blurb first), so the on-screen page ratio equals the
// printed page: what you see is what prints.

import type { PageFormat } from "../types";

export type BookProvider = "blurb";

export type BookSizeId =
  | "blurb-square-7"
  | "blurb-square-12"
  | "blurb-portrait-8x10"
  | "blurb-landscape-10x8"
  | "blurb-landscape-13x11";

export type BookOrientation = "square" | "portrait" | "landscape";

export interface BookSize {
  id: BookSizeId;
  name: string;
  provider: BookProvider;
  /** Trim width in millimetres. */
  widthMm: number;
  /** Trim height in millimetres. */
  heightMm: number;
  orientation: BookOrientation;
}

// The five Blurb photo-book trim sizes (inches -> mm, 1in = 25.4mm).
export const BOOK_SIZES: BookSize[] = [
  { id: "blurb-square-7", name: "Small Square 7x7", provider: "blurb", widthMm: 177.8, heightMm: 177.8, orientation: "square" },
  { id: "blurb-square-12", name: "Large Square 12x12", provider: "blurb", widthMm: 304.8, heightMm: 304.8, orientation: "square" },
  { id: "blurb-portrait-8x10", name: "Portrait 8x10", provider: "blurb", widthMm: 203.2, heightMm: 254.0, orientation: "portrait" },
  { id: "blurb-landscape-10x8", name: "Landscape 10x8", provider: "blurb", widthMm: 254.0, heightMm: 203.2, orientation: "landscape" },
  { id: "blurb-landscape-13x11", name: "Large Landscape 13x11", provider: "blurb", widthMm: 330.2, heightMm: 279.4, orientation: "landscape" },
];

// Print constants shared with the export (spec 009): full bleed and safe margin per
// Blurb's spec, and the target image resolution.
export const BLEED_MM = 3.175; // 1/8 inch
export const SAFE_MM = 6.35; // 1/4 inch
export const PRINT_DPI = 300;

// A fresh project starts square (ratio 1.0), so projects created before real sizes
// existed keep their look.
export const DEFAULT_BOOK_SIZE: BookSizeId = "blurb-square-7";

/** Aspect ratio (width / height) of a book size. */
export function ratioOf(size: BookSize): number {
  return size.widthMm / size.heightMm;
}

/** The book size for an id, or the default for an unknown / missing id. */
export function bookSizeOrDefault(id: string | undefined | null): BookSize {
  return (
    BOOK_SIZES.find((s) => s.id === id) ??
    BOOK_SIZES.find((s) => s.id === DEFAULT_BOOK_SIZE)!
  );
}

/** Map a legacy `PageFormat` (spec 001-007 docs) to the matching Blurb size. */
export function bookSizeForLegacyFormat(format: PageFormat | undefined | null): BookSizeId {
  switch (format) {
    case "portrait":
      return "blurb-portrait-8x10";
    case "landscape":
      return "blurb-landscape-10x8";
    default:
      return "blurb-square-7";
  }
}
