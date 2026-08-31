// Cover face geometry (specs 003 / 041 / 042), pure and unit-agnostic.
//
// A cover face draws its title and subtitle in a band, and contains its photo in the area on
// the other side of that band. The band is FIXED: its height depends only on whether a title
// and a subtitle are present, never on the font size, so enlarging the title never shrinks the
// photo and a subtitle-less cover gives that space back to it. That is what separates a cover
// from an interior page, whose band is derived from its text (spec 036, page-header.ts).
//
// Since spec 042 the band sits above the photo (the default) or below it, and the two are
// exact mirrors: same heights, same margins, the composition flipped. This module is the one
// place that decides it, so the editor, the book preview and the PDF cannot drift apart the
// way the mask painter did (issue #121). Everything is a fraction of the face WIDTH, resolved
// into whatever unit the caller works in: points in the PDF, container-query percentages on
// screen.

import type { CoverTextPosition } from "../types";

/** Outer (top / bottom) inset, the text inset, and the band of a face carrying no text at all. */
export const COVER_MARGIN = 0.06;
/**
 * Side inset, wider than the outer one (issue #127). A 6% side margin on a Blurb 10x8 is
 * 14.5 mm, and a photo filling the rest reads as pushed against the board edges rather than
 * mounted in a passepartout. The sides are the only edges that change: the band heights, the
 * outer margin and the text inset are untouched, so a cover keeps its proportions.
 */
export const COVER_SIDE_MARGIN = 0.09;
/** Band reserved for a title alone. */
export const COVER_TOP_TITLE = 0.15;
/** Band reserved for a title and a subtitle. */
export const COVER_TOP_SUBTITLE = 0.2;

export interface CoverTextInput {
  hasTitle: boolean;
  hasSubtitle: boolean;
}

/** The band reserved for the text, as a fraction of the face width. */
export function coverBandFrac({ hasTitle, hasSubtitle }: CoverTextInput): number {
  return hasSubtitle ? COVER_TOP_SUBTITLE : hasTitle ? COVER_TOP_TITLE : COVER_MARGIN;
}

/** The same band as a container-query length, for the two DOM renderers. */
export function coverBandCss(input: CoverTextInput): string {
  return `${Number((coverBandFrac(input) * 100).toFixed(4))}cqw`;
}

/** The margins as container-query lengths. */
export const COVER_MARGIN_CSS = `${COVER_MARGIN * 100}cqw`;
export const COVER_SIDE_MARGIN_CSS = `${COVER_SIDE_MARGIN * 100}cqw`;

export interface CoverAreasInput extends CoverTextInput {
  /** Absent (a face saved before spec 042) means "top". */
  position?: CoverTextPosition;
  /** The face's width and height, in the caller's unit. */
  w: number;
  h: number;
  /**
   * The width the band and the margin are fractions of. Defaults to `w`, which is what every
   * on-screen renderer wants. The printed cover wrap passes the PAGE trim width instead: a
   * hardcover face overhangs its block, and the text keeps the fraction the editor showed
   * rather than growing with the overhang (spec 041).
   */
  unitW?: number;
}

export interface CoverAreas {
  /** The text band, in the caller's unit. */
  band: number;
  /** The outer (top / bottom) margin, and the inset the text block hangs at. */
  margin: number;
  /** The side margin, wider than the outer one. */
  sideMargin: number;
  /** The area the photo is contained in, relative to the face's top-left corner. */
  photo: { x: number; y: number; w: number; h: number };
  /** Which edge the text block is anchored to, and how far it sits from it. */
  text: { anchor: CoverTextPosition; inset: number };
}

/**
 * The photo's area and the text block's anchor for one face.
 *
 * `top` reserves the band at the top and gives the photo everything from the band down to the
 * bottom margin. `bottom` is the mirror: the photo runs from the top margin down to the band,
 * and the text block's far edge sits one margin from the bottom of the face. The band and the
 * margin are the same on both sides, so the two layouts are one composition flipped, and a
 * face with no text at all (band = margin) is identical either way.
 *
 * The photo's own size inside this area is still the layout engine's business: a single
 * contained slot, ratio exact. This function only moves the rectangle.
 */
export function coverFaceAreas({ hasTitle, hasSubtitle, position, w, h, unitW }: CoverAreasInput): CoverAreas {
  const unit = unitW ?? w;
  const margin = COVER_MARGIN * unit;
  const sideMargin = COVER_SIDE_MARGIN * unit;
  const band = coverBandFrac({ hasTitle, hasSubtitle }) * unit;
  const bottom = position === "bottom";
  return {
    band,
    margin,
    sideMargin,
    photo: {
      x: sideMargin,
      y: bottom ? margin : band,
      w: w - 2 * sideMargin,
      h: h - band - margin,
    },
    text: { anchor: bottom ? "bottom" : "top", inset: margin },
  };
}

/**
 * The top of the text block's first line, from the face's top edge. `blockH` is the height of
 * the whole block in the caller's unit (one line, or the title plus the subtitle): at the top
 * the block hangs one margin below the edge and its height does not matter, at the bottom it
 * is what puts the block's last line one margin above the opposite edge.
 */
export function coverTextTop(areas: CoverAreas, faceH: number, blockH: number): number {
  return areas.text.anchor === "bottom" ? faceH - areas.margin - blockH : areas.margin;
}
