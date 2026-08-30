// Physical book sizes (pure catalog), the source of a project's page ratio and, from
// spec 009, its print geometry. Same shape as the other catalogs (themes, text-sizes):
// a small curated set a project picks by id. Dimensions are the real trim sizes of the
// supported print provider (Blurb first), so the on-screen page ratio equals the
// printed page: what you see is what prints.
//
// Since spec 041 the trims come from `blurb-specs.ts`, which holds what Blurb's own
// specification calculator returns. They used to be the rounded marketing names ("Standard
// Landscape 10x8" as a literal 10 x 8 in trim), which is one of the reasons Blurb rejected
// every PDF we exported (issue #114): that book really trims at 9.5 x 8.0 in. The name a
// user picks from is still Blurb's name; the geometry underneath is the real one.

import { PAGE_SPECS } from "./blurb-specs";
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

// The five Blurb photo-book sizes we offer. The label keeps Blurb's marketing name (that is
// what the user recognises and what they select on blurb.com); `widthMm` / `heightMm` are the
// real trim from the spec calculator, converted from inches.
const IN_TO_MM = 25.4;
const trim = (id: BookSizeId) => ({
  widthMm: PAGE_SPECS[id].trimIn.w * IN_TO_MM,
  heightMm: PAGE_SPECS[id].trimIn.h * IN_TO_MM,
});

export const BOOK_SIZES: BookSize[] = [
  { id: "blurb-square-7", name: "Small Square 7x7", provider: "blurb", ...trim("blurb-square-7"), orientation: "square" },
  { id: "blurb-square-12", name: "Large Square 12x12", provider: "blurb", ...trim("blurb-square-12"), orientation: "square" },
  { id: "blurb-portrait-8x10", name: "Portrait 8x10", provider: "blurb", ...trim("blurb-portrait-8x10"), orientation: "portrait" },
  { id: "blurb-landscape-10x8", name: "Landscape 10x8", provider: "blurb", ...trim("blurb-landscape-10x8"), orientation: "landscape" },
  { id: "blurb-landscape-13x11", name: "Large Landscape 13x11", provider: "blurb", ...trim("blurb-landscape-13x11"), orientation: "landscape" },
];

// Print constants shared with the export (spec 009). The per-size bleed and safe insets now
// live in `blurb-specs.ts`, because Blurb's are asymmetric: BLEED_MM is kept as the nominal
// 1/8 inch every Blurb size happens to use, SAFE_MM as the outside safe inset.
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
