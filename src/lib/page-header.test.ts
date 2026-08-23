import { describe, it, expect } from "vitest";
import {
  headerGeometry,
  headerFontSize,
  headerFontCss,
  halfLeading,
  CLEARANCE,
  LINE,
  GAP_FRAC,
  PAGE_MARGIN,
  HEADER_TOP,
  F_PAGE_TITLE,
  F_PAGE_SUBTITLE,
} from "./page-header";

const SCALES = { sm: 0.85, md: 1, lg: 1.2, xl: 1.45 } as const;
const W = 1000;
const H = 1000;

// A page laid out the way print does it: sizes are pure fractions of the width.
const page = (titleScale: number, subtitleScale: number | null, w = W, h = H) =>
  headerGeometry({
    titleSize: titleScale > 0 ? F_PAGE_TITLE * w * titleScale : 0,
    subtitleSize: subtitleScale ? F_PAGE_SUBTITLE * w * subtitleScale : 0,
    pageW: w,
    pageH: h,
  });

// Bottom of the last line box: the glyph top less its half-leading, plus the whole line box.
const lastLineBottom = (size: number, glyphTop: number) => glyphTop - halfLeading(size) + LINE * size;

describe("headerGeometry: the band follows the text", () => {
  it("puts title + subtitle at md at the documented reference band", () => {
    const g = page(SCALES.md, SCALES.md);
    // 0.054*H + (1.15*0.031 + 0.3*0.022 + 1.15*0.022 + 0.025)*W = 0.054 + 0.09255 on a square
    // page: ~14.7% of the width, up from the old flat 12.5% (spec 036 R5).
    expect(g.band).toBeCloseTo(146.55, 2);
    expect(g.hasHeader).toBe(true);
  });

  it("grows strictly from sm to xl", () => {
    const bands = [SCALES.sm, SCALES.md, SCALES.lg, SCALES.xl].map((s) => page(s, s).band);
    for (let i = 1; i < bands.length; i++) expect(bands[i]).toBeGreaterThan(bands[i - 1]);
  });
});

describe("headerGeometry: monotonic growth, title alone too", () => {
  it("grows strictly from sm to xl for a title with no subtitle", () => {
    const bands = [SCALES.sm, SCALES.md, SCALES.lg, SCALES.xl].map((s) => page(s, null).band);
    for (let i = 1; i < bands.length; i++) expect(bands[i]).toBeGreaterThan(bands[i - 1]);
  });
});

describe("headerGeometry: the clearance is constant (R2)", () => {
  it("is the same at sm, md, lg and xl", () => {
    for (const s of Object.values(SCALES)) {
      const g = page(s, s);
      const bottom = lastLineBottom(F_PAGE_SUBTITLE * W * s, g.subtitleGlyphTop);
      expect(g.band - bottom).toBeCloseTo(CLEARANCE * W, 8);
    }
  });

  it("is the same for a title alone as for a title with a subtitle", () => {
    const titled = page(SCALES.xl, null);
    expect(titled.band - lastLineBottom(F_PAGE_TITLE * W * SCALES.xl, titled.titleGlyphTop)).toBeCloseTo(
      CLEARANCE * W,
      8,
    );
    const withSub = page(SCALES.xl, SCALES.xl);
    expect(
      withSub.band - lastLineBottom(F_PAGE_SUBTITLE * W * SCALES.xl, withSub.subtitleGlyphTop),
    ).toBeCloseTo(CLEARANCE * W, 8);
  });

  it("is the same when the title and the subtitle are at different levels", () => {
    const g = page(SCALES.xl, SCALES.sm);
    const bottom = lastLineBottom(F_PAGE_SUBTITLE * W * SCALES.sm, g.subtitleGlyphTop);
    expect(g.band - bottom).toBeCloseTo(CLEARANCE * W, 8);
  });

  it("reports the clearance it applied", () => {
    expect(page(SCALES.md, SCALES.md).clearance).toBeCloseTo(CLEARANCE * W, 8);
  });
});

describe("headerGeometry: the title to subtitle gap (R3)", () => {
  const OLD_GAP = 0.01 * 0.86 * W; // the old mt-[1%] of a header box inset 7% on each side

  it("is tighter at md than the gap it replaces", () => {
    const g = page(SCALES.md, SCALES.md);
    expect(g.gap).toBeGreaterThan(0);
    expect(g.gap).toBeLessThan(OLD_GAP);
  });

  it("scales with the subtitle, not with the title", () => {
    expect(page(SCALES.md, SCALES.xl).gap).toBeCloseTo(page(SCALES.xl, SCALES.xl).gap, 8);
    expect(page(SCALES.md, SCALES.xl).gap).toBeGreaterThan(page(SCALES.md, SCALES.sm).gap);
    expect(page(SCALES.md, SCALES.md).gap).toBeCloseTo(GAP_FRAC * F_PAGE_SUBTITLE * W, 8);
  });
});

describe("headerGeometry: pages without a full header", () => {
  it("keeps the plain page margin when there is no text at all", () => {
    const g = headerGeometry({ titleSize: 0, subtitleSize: 0, pageW: 1000, pageH: 2000 });
    expect(g.hasHeader).toBe(false);
    expect(g.band).toBeCloseTo(PAGE_MARGIN * 1000, 8); // width-derived, exactly as today
  });

  it("gives a subtitle without a title the title's place, with no gap", () => {
    const g = page(0, SCALES.md);
    const size = F_PAGE_SUBTITLE * W;
    expect(g.gap).toBe(0);
    expect(g.subtitleGlyphTop).toBeCloseTo(HEADER_TOP * H + halfLeading(size), 8);
    expect(g.band).toBeCloseTo(HEADER_TOP * H + LINE * size + CLEARANCE * W, 8);
  });

  it("gives a title without a subtitle no gap and no second line", () => {
    const g = page(SCALES.md, null);
    const size = F_PAGE_TITLE * W;
    expect(g.gap).toBe(0);
    expect(g.band).toBeCloseTo(HEADER_TOP * H + LINE * size + CLEARANCE * W, 8);
  });
});

describe("headerGeometry: non-square books", () => {
  it("takes the top inset from the height and everything else from the width", () => {
    // Blurb portrait 8x10 and landscape 13x11, in mm.
    const portrait = page(SCALES.md, SCALES.md, 203.2, 254);
    const landscape = page(SCALES.md, SCALES.md, 330.2, 279.4);
    const textPart = (w: number) => (LINE * F_PAGE_TITLE + GAP_FRAC * F_PAGE_SUBTITLE + LINE * F_PAGE_SUBTITLE + CLEARANCE) * w;
    expect(portrait.band).toBeCloseTo(HEADER_TOP * 254 + textPart(203.2), 8);
    expect(landscape.band).toBeCloseTo(HEADER_TOP * 279.4 + textPart(330.2), 8);
  });

  it("scales linearly with the page, so an album reads the same at any trim", () => {
    expect(page(SCALES.md, SCALES.md, 2000, 2000).band).toBeCloseTo(2 * page(SCALES.md, SCALES.md).band, 8);
  });
});

describe("headerFontSize / headerFontCss: one size rule for screen and print", () => {
  it("is a pure fraction of the page width, times the level", () => {
    expect(headerFontSize(F_PAGE_TITLE, 1000, 1)).toBeCloseTo(31, 8);
    expect(headerFontSize(F_PAGE_TITLE, 500, 1)).toBeCloseTo(15.5, 8);
    expect(headerFontSize(F_PAGE_SUBTITLE, 500, SCALES.xl)).toBeCloseTo(11 * SCALES.xl, 8);
    // Twice the page, twice the text: no clamp to break the proportion at any zoom.
    expect(headerFontSize(F_PAGE_TITLE, 2000, 1)).toBeCloseTo(2 * headerFontSize(F_PAGE_TITLE, 1000, 1), 8);
  });

  it("builds the CSS from the same fractions", () => {
    expect(headerFontCss(F_PAGE_TITLE, "--page-title-scale")).toBe("calc(3.1cqw * var(--page-title-scale))");
    expect(headerFontCss(F_PAGE_SUBTITLE, "--page-subtitle-scale")).toBe("calc(2.2cqw * var(--page-subtitle-scale))");
  });
});

describe("headerGeometry on the screen path", () => {
  // What a component does: size the text from the page, then derive the band from that size.
  const screen = (pageW: number, scale = 1) => {
    const titleSize = headerFontSize(F_PAGE_TITLE, pageW, scale);
    const subtitleSize = headerFontSize(F_PAGE_SUBTITLE, pageW, scale);
    return { ...headerGeometry({ titleSize, subtitleSize, pageW, pageH: pageW }), titleSize, subtitleSize };
  };

  it("keeps the clearance constant at every editor and preview width", () => {
    for (const w of [300, 500, 776, 1079, 1600]) {
      const g = screen(w);
      const bottom = lastLineBottom(g.subtitleSize, g.subtitleGlyphTop);
      expect(g.band - bottom).toBeCloseTo(CLEARANCE * w, 8);
    }
  });

  it("keeps the clearance constant at every size level, at a realistic editor width", () => {
    for (const s of Object.values(SCALES)) {
      const g = screen(1079, s);
      const bottom = lastLineBottom(g.subtitleSize, g.subtitleGlyphTop);
      expect(g.band - bottom).toBeCloseTo(CLEARANCE * 1079, 8);
    }
  });

  it("is the SAME fraction of the page at every width, so zoom scales and never recomposes", () => {
    // This is what print computes too: editor, book preview and PDF land on one number.
    const expected =
      HEADER_TOP + LINE * F_PAGE_TITLE + GAP_FRAC * F_PAGE_SUBTITLE + LINE * F_PAGE_SUBTITLE + CLEARANCE;
    for (const w of [300, 500, 776, 1079, 1600]) {
      expect(screen(w).band / w, `page ${w}px`).toBeCloseTo(expected, 8);
    }
  });
});
