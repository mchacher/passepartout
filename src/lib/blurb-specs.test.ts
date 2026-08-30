import { describe, it, expect } from "vitest";
import { PAGE_SPECS, pageMediaIn } from "./blurb-specs";
import { BOOK_SIZES, bookSizeOrDefault } from "./book-sizes";
import { interiorPageGeometry, inToPt, type PageInput } from "./print";

// The values on the right of each expectation are what Blurb's own specification calculator
// returns under "Final, exported PDF should measure (w x h)". They are the contract: the
// uploader's preflight compares the PDF media box against them and rejects anything else
// (issue #114). Asserting geometry invariants alone is what let a 10.25 x 8.25 page ship for
// a book that wanted 9.625 x 8.25.
describe("Blurb page specifications", () => {
  it("gives every catalog size a spec", () => {
    for (const s of BOOK_SIZES) expect(PAGE_SPECS[s.id]).toBeDefined();
  });

  it("matches the final exported PDF size Blurb demands", () => {
    expect(pageMediaIn("blurb-landscape-10x8")).toEqual({ w: 9.625, h: 8.25 });
    expect(pageMediaIn("blurb-portrait-8x10")).toEqual({ w: 8.125, h: 10.25 });
    expect(pageMediaIn("blurb-square-7")).toEqual({ w: 6.875, h: 6.875 });
    expect(pageMediaIn("blurb-square-12")).toEqual({ w: 11.875, h: 12 });
    expect(pageMediaIn("blurb-landscape-13x11")).toEqual({ w: 12.625, h: 10.875 });
  });

  it("adds the bleed to three edges, never the binding one", () => {
    for (const s of BOOK_SIZES) {
      const spec = PAGE_SPECS[s.id];
      const media = pageMediaIn(s.id);
      expect(media.w - spec.trimIn.w).toBeCloseTo(spec.bleedIn, 10);
      expect(media.h - spec.trimIn.h).toBeCloseTo(2 * spec.bleedIn, 10);
    }
  });

  it("keeps the safe boundary wider on the binding edge", () => {
    for (const s of BOOK_SIZES) {
      const spec = PAGE_SPECS[s.id];
      expect(spec.safeBindingIn).toBeGreaterThan(spec.safeOuterIn);
    }
  });
});

// The end-to-end check: what the painter will actually put in the PDF, in points, for every
// size. This is the assertion that fails the day a trim or a bleed rule drifts from Blurb.
describe("emitted page media box", () => {
  const input = (id: string): PageInput => ({
    size: bookSizeOrDefault(id),
    items: [],
    layoutId: "single",
    whitespace: 4,
    title: "",
    subtitle: "",
    scales: { pageTitle: 1, pageSubtitle: 1, caption: 1 },
  });

  it("equals Blurb's final exported PDF size for every catalog size", () => {
    for (const s of BOOK_SIZES) {
      const target = pageMediaIn(s.id);
      for (const side of ["left", "right"] as const) {
        const g = interiorPageGeometry({ ...input(s.id), bindingSide: side });
        expect(g.mediaBox.w).toBeCloseTo(inToPt(target.w), 6);
        expect(g.mediaBox.h).toBeCloseTo(inToPt(target.h), 6);
      }
    }
  });
});
