// Content-page header geometry (spec 036), pure. A page draws its title and optional
// subtitle in a band at the top; the photo area starts below it.
//
// The band used to be a constant fraction of the page width (12.5% with a subtitle, 10%
// with a title alone) while the text inside it scaled with the per-role size levels
// (spec 006: sm 0.85 .. xl 1.45). The clearance under the header therefore drifted with the
// chosen sizes, and at md it was already gone. Here the band is DERIVED from the text, so
// the clearance is the same at every level (issue 67).
//
// The trade this reverses is recorded in the spec: a band that guarantees clearance must
// grow with the text, so a larger title does take a little room from the photos. Cover faces
// keep their fixed bands (their margins are far larger; see print.ts).
//
// Everything here works in ONE absolute unit, whatever the caller uses (px on screen, points
// in the PDF). The header text is a pure fraction of the page width on both sides, with no
// readability clamp: a page title is 3.1% of the page whether you are looking at the editor,
// the book preview or the printed PDF, so the band is the same fraction of the page
// everywhere and zooming the editor scales the composition instead of changing it. That
// clamp (13..19px) is what used to make the on-screen title smaller than the printed one.

/** Where the first line box starts, as a fraction of the page HEIGHT. */
export const HEADER_TOP = 0.054;

/** Page title font size, as a fraction of the page WIDTH (on screen: 3.1cqw). */
export const F_PAGE_TITLE = 0.031;

/** Page subtitle font size, as a fraction of the page WIDTH (on screen: 2.2cqw). */
export const F_PAGE_SUBTITLE = 0.022;

/** Page margin (sides, bottom, and the whole inset of a page with no text), fraction of width. */
export const PAGE_MARGIN = 0.05;

/**
 * Line-box factor for the two header lines. The components set it explicitly (leading), so
 * this model and the DOM measure the same box. Tight on purpose: a header line is one line.
 */
export const LINE = 1.15;

/** Title to subtitle gap, as a multiple of the subtitle font size. Tighter than the old 1%. */
export const GAP_FRAC = 0.3;

/** Clearance between the last text line and the content box, as a fraction of the page width. */
export const CLEARANCE = 0.025;

export interface HeaderInput {
  /** Title font size in the caller's unit; 0 when the page has no title. */
  titleSize: number;
  /** Subtitle font size in the caller's unit; 0 when the page has no subtitle. */
  subtitleSize: number;
  pageW: number;
  pageH: number;
}

export interface HeaderGeometry {
  /** Whether any text is drawn. */
  hasHeader: boolean;
  /** Top inset of the content box: the whole band, or the plain margin on a bare page. */
  band: number;
  /** Gap between the title's line box and the subtitle's. 0 unless both are present. */
  gap: number;
  /** Top of the title's GLYPHS, from the top of the page. */
  titleGlyphTop: number;
  /** Top of the subtitle's GLYPHS, from the top of the page. */
  subtitleGlyphTop: number;
  /** The clearance actually left under the last line. Constant by construction. */
  clearance: number;
}

/**
 * Half-leading of a line box: from the top of the line box to the top of the glyphs. A
 * browser adds it from `line-height`; the PDF painter places glyphs directly, so print adds
 * it explicitly and the two land within a few hundredths of an em of each other. It is an
 * approximation on both sides (this assumes a 1em content area, a browser uses the font's
 * ascent + descent, and the painter turns the glyph top into a baseline with its own factor),
 * but the glyphs stay inside the reserved line box either way, so the band and the clearance
 * are exact even where the baselines differ slightly.
 */
export function halfLeading(size: number): number {
  return ((LINE - 1) / 2) * size;
}

/**
 * The header geometry of one page, in the caller's unit. A page with no text keeps the plain
 * page margin, so albums without page titles are untouched. A subtitle without a title takes
 * the title's place: no gap, same clearance.
 */
export function headerGeometry({ titleSize, subtitleSize, pageW, pageH }: HeaderInput): HeaderGeometry {
  const clearance = CLEARANCE * pageW;
  if (titleSize <= 0 && subtitleSize <= 0) {
    return {
      hasHeader: false,
      band: PAGE_MARGIN * pageW,
      gap: 0,
      titleGlyphTop: 0,
      subtitleGlyphTop: 0,
      clearance,
    };
  }

  const top = HEADER_TOP * pageH;
  // The gap only exists between two lines, and it belongs to the subtitle, so it scales with
  // it: a bigger subtitle sits a little further from the title, a smaller one hugs it.
  const gap = titleSize > 0 && subtitleSize > 0 ? GAP_FRAC * subtitleSize : 0;
  const subtitleLineTop = top + (titleSize > 0 ? LINE * titleSize + gap : 0);
  const lastLineBottom = subtitleSize > 0 ? subtitleLineTop + LINE * subtitleSize : top + LINE * titleSize;

  return {
    hasHeader: true,
    band: lastLineBottom + clearance,
    gap,
    titleGlyphTop: top + halfLeading(titleSize),
    subtitleGlyphTop: subtitleLineTop + halfLeading(subtitleSize),
    clearance,
  };
}

/** The font size of a header line: a pure fraction of the page width, times the size level. */
export function headerFontSize(fracW: number, pageW: number, scale: number): number {
  return fracW * pageW * scale;
}

/**
 * The CSS for that same size, built from the same constant so the DOM and the band cannot
 * drift. Container-query units, so it tracks the page element rather than the viewport.
 */
export function headerFontCss(fracW: number, scaleVar: string): string {
  // Round the percentage: 0.022 * 100 is 2.1999999999999997 in binary floating point, and a
  // stylesheet should read 2.2cqw.
  const cqw = Number((fracW * 100).toFixed(4));
  return `calc(${cqw}cqw * var(${scaleVar}))`;
}
