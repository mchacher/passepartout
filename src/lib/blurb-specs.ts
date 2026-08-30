// Blurb's real print specifications (spec 041). This is DATA, harvested from Blurb's own
// book size specification calculator, not arithmetic we invented:
//
//   https://www.blurb.com/make/pdf_to_book/booksize_calculator
//
// Blurb is explicit that the sizes on its pricing pages are rounded marketing names and that
// you must not derive the bleed from the trim yourself. Specs 008 and 009 did exactly that,
// which is why every PDF we produced failed preflight (issue #114): "Standard Landscape 10x8"
// is really a 9.5 x 8.0 in trim, and the page bleed is asymmetric.
//
// The numbers below are reproduced by `scripts/harvest-blurb-specs.mjs`, which replays the
// calculator for every size / cover type / paper / page count and prints this table. Refresh
// it rather than editing a value by hand.
//
// All lengths here are INCHES, the unit the calculator reports in. `print.ts` converts.

import type { BookSizeId } from "./book-sizes";

/** The three cover constructions Blurb offers, with their calculator ids. */
export type CoverType = "softcover" | "dust-jacket" | "imagewrap";

export interface PageSpec {
  /** Real trim, the finished page after cutting. */
  trimIn: { w: number; h: number };
  /**
   * Bleed, added to the top, the bottom AND the outside edge, never the binding edge.
   * Verbatim from the calculator: "while bleed is added to all four sides of your covers, it
   * is only added to the top, bottom, and outside of your individual page layout. The inside
   * edge is the gutter of your book."
   */
  bleedIn: number;
  /** Safe boundary inset on the top, bottom and outside edges. */
  safeOuterIn: number;
  /** Safe boundary inset on the binding edge, larger because content binds into the gutter. */
  safeBindingIn: number;
}

// Page specifications. Identical for every cover type, paper and page count: the calculator
// returns the same page block whatever else you select.
export const PAGE_SPECS: Record<BookSizeId, PageSpec> = {
  "blurb-square-7": { trimIn: { w: 6.75, h: 6.625 }, bleedIn: 0.125, safeOuterIn: 0.25, safeBindingIn: 0.5 },
  "blurb-square-12": { trimIn: { w: 11.75, h: 11.75 }, bleedIn: 0.125, safeOuterIn: 0.25, safeBindingIn: 0.5 },
  "blurb-portrait-8x10": { trimIn: { w: 8.0, h: 10.0 }, bleedIn: 0.125, safeOuterIn: 0.25, safeBindingIn: 0.5 },
  "blurb-landscape-10x8": { trimIn: { w: 9.5, h: 8.0 }, bleedIn: 0.125, safeOuterIn: 0.25, safeBindingIn: 0.5 },
  "blurb-landscape-13x11": { trimIn: { w: 12.5, h: 10.625 }, bleedIn: 0.125, safeOuterIn: 0.25, safeBindingIn: 0.5 },
};

/**
 * The page size Blurb's preflight demands: the trim plus ONE bleed horizontally (the outside
 * edge) and TWO vertically (top and bottom). This is the value the uploader compares against,
 * reported as "Final, exported PDF should measure (w x h)".
 */
export function pageMediaIn(size: BookSizeId): { w: number; h: number } {
  const s = PAGE_SPECS[size];
  return { w: s.trimIn.w + s.bleedIn, h: s.trimIn.h + 2 * s.bleedIn };
}
