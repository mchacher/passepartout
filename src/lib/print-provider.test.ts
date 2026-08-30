import { describe, it, expect } from "vitest";
import { coverMediaIn, pageMediaIn, roundUpPageCount, spineWidthIn, type CoverSpec, type PageSpec } from "./print-provider";
import { BLURB } from "./provider-blurb";
import { coverSpecsFor, pageSpecOf, providerOrDefault } from "./print-providers";
import { BOOK_SIZES, bookSizeOrDefault } from "./book-sizes";
import { interiorPageGeometry, inToPt, type PageInput } from "./print";

// The values on the right of each expectation are what Blurb's own specification calculator
// returns under "Final, exported PDF should measure (w x h)". They are the contract: the
// uploader's preflight compares the PDF media box against them and rejects anything else
// (issue #114). Asserting geometry invariants alone is what let a 10.25 x 8.25 page ship for a
// book that wanted 9.625 x 8.25.
describe("Blurb page specifications", () => {
  it("gives every catalog size a spec", () => {
    for (const s of BOOK_SIZES) expect(pageSpecOf(s.provider, s.id)).toBeDefined();
  });

  it("matches the final exported PDF size Blurb demands", () => {
    const media = (id: string) => pageMediaIn(BLURB.pages[id]);
    expect(media("blurb-landscape-10x8")).toEqual({ w: 9.625, h: 8.25 });
    expect(media("blurb-portrait-8x10")).toEqual({ w: 8.125, h: 10.25 });
    expect(media("blurb-square-7")).toEqual({ w: 6.875, h: 6.875 });
    expect(media("blurb-square-12")).toEqual({ w: 11.875, h: 12 });
    expect(media("blurb-landscape-13x11")).toEqual({ w: 12.625, h: 10.875 });
  });

  it("adds the bleed to three edges, never the binding one", () => {
    for (const spec of Object.values(BLURB.pages)) {
      expect(spec.bleedEdges).toBe("outer-three");
      const media = pageMediaIn(spec);
      expect(media.w - spec.trimIn.w).toBeCloseTo(spec.bleedIn, 10);
      expect(media.h - spec.trimIn.h).toBeCloseTo(2 * spec.bleedIn, 10);
    }
  });

  it("keeps the safe boundary wider on the binding edge", () => {
    for (const spec of Object.values(BLURB.pages)) {
      expect(spec.safeBindingIn).toBeGreaterThan(spec.safeOuterIn);
    }
  });
});

describe("Blurb cover specifications", () => {
  it("matches the wrap Blurb demanded for a 26 page Standard Landscape ImageWrap", () => {
    const cover = coverSpecsFor("blurb", "blurb-landscape-10x8").find((c) => c.id === "imagewrap");
    expect(cover).toBeDefined();
    const spine = spineWidthIn(cover!, "standard", 26);
    expect(spine).toBeCloseTo(0.458, 6);
    const media = coverMediaIn(BLURB.pages["blurb-landscape-10x8"], cover!, spine);
    expect(media.w).toBeCloseTo(20.597, 3);
    expect(media.h).toBeCloseTo(9.0, 3);
  });

  it("models a softcover as a flush wrap and a dust jacket as two flaps", () => {
    const page: PageSpec = {
      trimIn: { w: 5, h: 5 },
      bleedIn: 0.125,
      bleedEdges: "outer-three",
      safeOuterIn: 0.25,
      safeBindingIn: 0.5,
    };
    const flat = (over: CoverSpec["overhangIn"], flap: number): CoverSpec => ({
      id: "x",
      labelKey: "x",
      overhangIn: over,
      bleedIn: 0.125,
      flapIn: flap,
      spineIn: { standard: [], premium: [] },
    });
    // Mini Square softcover at 20 pages, and the same book as a dust jacket, both from the
    // calculator: 10.306 x 5.25 and 15.236 x 5.25.
    expect(coverMediaIn(page, flat({ w: 0, h: 0 }, 0), 0.056).w).toBeCloseTo(10.306, 3);
    expect(coverMediaIn(page, flat({ w: 0, h: 0 }, 2.264), 0.458).w).toBeCloseTo(15.236, 3);
    expect(coverMediaIn(page, flat({ w: 0, h: 0 }, 0), 0.056).h).toBeCloseTo(5.25, 3);
  });
});

describe("spineWidthIn", () => {
  const cover: CoverSpec = {
    id: "x",
    labelKey: "x",
    overhangIn: { w: 0, h: 0 },
    bleedIn: 0.125,
    flapIn: 0,
    spineIn: { standard: [{ pages: 20, width: 0.1 }, { pages: 80, width: 0.4 }], premium: [] },
  };

  it("interpolates between the sampled page counts", () => {
    expect(spineWidthIn(cover, "standard", 50)).toBeCloseTo(0.25, 6);
  });

  it("clamps outside the sampled range rather than extrapolating", () => {
    expect(spineWidthIn(cover, "standard", 4)).toBeCloseTo(0.1, 6);
    expect(spineWidthIn(cover, "standard", 400)).toBeCloseTo(0.4, 6);
  });

  it("returns zero when the paper has no samples, leaving the override to decide", () => {
    expect(spineWidthIn(cover, "premium", 40)).toBe(0);
  });
});

describe("roundUpPageCount", () => {
  it("rounds up to the provider's multiple", () => {
    expect(roundUpPageCount(BLURB.pageCount, 25)).toBe(26);
    expect(roundUpPageCount(BLURB.pageCount, 26)).toBe(26);
    expect(roundUpPageCount({ multipleOf: 4, min: 20, max: 200 }, 25)).toBe(28);
  });
});

describe("providerOrDefault", () => {
  it("falls back to Blurb for an unknown id", () => {
    expect(providerOrDefault("nope").id).toBe("blurb");
    expect(providerOrDefault(undefined).id).toBe("blurb");
  });
});

// The end-to-end check: what the painter will actually put in the PDF, in points, for every
// size. This is the assertion that fails the day a trim or a bleed rule drifts.
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

  it("equals the provider's final exported PDF size for every catalog size", () => {
    for (const s of BOOK_SIZES) {
      const target = pageMediaIn(pageSpecOf(s.provider, s.id)!);
      for (const side of ["left", "right"] as const) {
        const g = interiorPageGeometry({ ...input(s.id), bindingSide: side });
        expect(g.mediaBox.w).toBeCloseTo(inToPt(target.w), 6);
        expect(g.mediaBox.h).toBeCloseTo(inToPt(target.h), 6);
      }
    }
  });
});
