// Blurb, as a `PrintProvider` (spec 041). This file is DATA, harvested from Blurb's own book
// size specification calculator, not arithmetic we invented:
//
//   https://www.blurb.com/make/pdf_to_book/booksize_calculator
//
// Blurb is explicit that the sizes on its pricing pages are rounded marketing names and that
// you must not derive the bleed from the trim yourself. Specs 008 and 009 did exactly that,
// which is why every PDF we produced failed preflight (issue #114): "Standard Landscape 10x8"
// really trims at 9.5 x 8.0 in, and the page bleed is asymmetric.
//
// `scripts/harvest-blurb-specs.mjs` regenerates the two tables below. Refresh it rather than
// editing a value by hand. All lengths are inches.

import type { CoverSpec, PageSpec, PrintProvider } from "./print-provider";

// Page specifications. Identical for every cover type, paper and page count: the calculator
// returns the same page block whatever else you select.
const pages: Record<string, PageSpec> = {
  "blurb-square-7": page(6.75, 6.625),
  "blurb-square-12": page(11.75, 11.75),
  "blurb-portrait-8x10": page(8.0, 10.0),
  "blurb-landscape-10x8": page(9.5, 8.0),
  "blurb-landscape-13x11": page(12.5, 10.625),
};

function page(w: number, h: number): PageSpec {
  return {
    trimIn: { w, h },
    bleedIn: 0.125,
    // Verbatim from the calculator: "while bleed is added to all four sides of your covers, it
    // is only added to the top, bottom, and outside of your individual page layout. The inside
    // edge is the gutter of your book."
    bleedEdges: "outer-three",
    safeOuterIn: 0.25,
    safeBindingIn: 0.5,
  };
}

const imagewrap = (over: { w: number; h: number }, spine: CoverSpec["spineIn"]): CoverSpec => ({
  id: "imagewrap",
  labelKey: "export.coverImageWrap",
  overhangIn: over,
  bleedIn: 0.306,
  flapIn: 0,
  spineIn: spine,
});

// Cover specifications by size then construction. A size that Blurb does not offer in a given
// construction is simply absent, and so is a row we have not measured yet: `print.ts` reports
// that rather than guessing. Guessing is what produced a 20.496 in wrap for a book that wanted
// 20.597 in.
const covers: Record<string, Record<string, CoverSpec>> = {
  "blurb-landscape-10x8": {
    imagewrap: imagewrap(
      { w: 0.2635, h: 0.194 },
      { standard: [{ pages: 26, width: 0.458 }], premium: [{ pages: 26, width: 0.458 }] },
    ),
  },
};

export const BLURB: PrintProvider = {
  id: "blurb",
  name: "Blurb",
  specUrl: "https://www.blurb.com/make/pdf_to_book/booksize_calculator",
  // "Submit an even number of pages", from Blurb's own checklist. The bounds are its PDF to
  // Book limits.
  pageCount: { multipleOf: 2, min: 20, max: 440 },
  dpi: 300,
  pages,
  covers,
};
