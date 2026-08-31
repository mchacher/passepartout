import { describe, it, expect } from "vitest";
import {
  COVER_MARGIN,
  COVER_SIDE_MARGIN,
  COVER_TOP_SUBTITLE,
  COVER_TOP_TITLE,
  coverBandCss,
  coverBandFrac,
  coverFaceAreas,
  coverTextTop,
} from "./cover-layout";

// A landscape face, in whatever unit the caller works in.
const W = 1000;
const H = 800;
const M = COVER_MARGIN * W; // 60, the outer (top / bottom) margin and the text inset
const SM = COVER_SIDE_MARGIN * W; // 90, the wider side margin (issue #127)

describe("coverBandFrac", () => {
  it("reserves one band per text case, never depending on the font size", () => {
    expect(coverBandFrac({ hasTitle: true, hasSubtitle: true })).toBe(COVER_TOP_SUBTITLE);
    expect(coverBandFrac({ hasTitle: true, hasSubtitle: false })).toBe(COVER_TOP_TITLE);
    expect(coverBandFrac({ hasTitle: false, hasSubtitle: false })).toBe(COVER_MARGIN);
    // A subtitle without a title takes the subtitle band: the block still has two lines' room.
    expect(coverBandFrac({ hasTitle: false, hasSubtitle: true })).toBe(COVER_TOP_SUBTITLE);
  });

  it("gives the DOM the same band as a container-query length", () => {
    expect(coverBandCss({ hasTitle: true, hasSubtitle: true })).toBe("20cqw");
    expect(coverBandCss({ hasTitle: true, hasSubtitle: false })).toBe("15cqw");
    expect(coverBandCss({ hasTitle: false, hasSubtitle: false })).toBe("6cqw");
  });
});

describe("coverFaceAreas", () => {
  it("keeps the original layout when the text sits at the top", () => {
    const a = coverFaceAreas({ hasTitle: true, hasSubtitle: true, position: "top", w: W, h: H });
    expect(a.band).toBe(COVER_TOP_SUBTITLE * W); // 200
    expect(a.photo).toEqual({ x: SM, y: 200, w: W - 2 * SM, h: H - 200 - M });
    expect(a.text).toEqual({ anchor: "top", inset: M });
  });

  it("defaults to the top layout for a face saved before the choice existed", () => {
    const legacy = coverFaceAreas({ hasTitle: true, hasSubtitle: true, w: W, h: H });
    const top = coverFaceAreas({ hasTitle: true, hasSubtitle: true, position: "top", w: W, h: H });
    expect(legacy).toEqual(top);
  });

  it("mirrors the band under the photo when the text sits at the bottom", () => {
    const a = coverFaceAreas({ hasTitle: true, hasSubtitle: true, position: "bottom", w: W, h: H });
    expect(a.band).toBe(COVER_TOP_SUBTITLE * W);
    expect(a.photo).toEqual({ x: SM, y: M, w: W - 2 * SM, h: H - 200 - M });
    expect(a.text).toEqual({ anchor: "bottom", inset: M });
  });

  it("gives the photo the same area in both positions, only moved", () => {
    for (const [hasTitle, hasSubtitle] of [[true, true], [true, false], [false, true], [false, false]] as const) {
      const top = coverFaceAreas({ hasTitle, hasSubtitle, position: "top", w: W, h: H });
      const bottom = coverFaceAreas({ hasTitle, hasSubtitle, position: "bottom", w: W, h: H });
      expect(bottom.photo.w).toBe(top.photo.w);
      expect(bottom.photo.h).toBe(top.photo.h);
      // The gap left above the photo at the bottom is the gap left below it at the top.
      expect(bottom.photo.y).toBe(top.margin);
      expect(H - (top.photo.y + top.photo.h)).toBe(top.margin);
      expect(H - (bottom.photo.y + bottom.photo.h)).toBe(bottom.band);
    }
  });

  it("renders a face with no text identically in both positions", () => {
    const top = coverFaceAreas({ hasTitle: false, hasSubtitle: false, position: "top", w: W, h: H });
    const bottom = coverFaceAreas({ hasTitle: false, hasSubtitle: false, position: "bottom", w: W, h: H });
    expect(bottom.photo).toEqual(top.photo);
    expect(top.band).toBe(top.margin);
  });
});

describe("coverTextTop", () => {
  it("hangs the block one margin below the top edge", () => {
    const a = coverFaceAreas({ hasTitle: true, hasSubtitle: true, position: "top", w: W, h: H });
    expect(coverTextTop(a, H, 120)).toBe(M);
    expect(coverTextTop(a, H, 40)).toBe(M); // the block's height does not move its top
  });

  it("puts the block's last line one margin above the bottom edge", () => {
    const a = coverFaceAreas({ hasTitle: true, hasSubtitle: true, position: "bottom", w: W, h: H });
    const blockH = 120;
    const top = coverTextTop(a, H, blockH);
    expect(top + blockH).toBe(H - M);
    // The whole block stays inside the band it was given.
    expect(top).toBeGreaterThanOrEqual(H - a.band);
  });
});

describe("a printed face that overhangs its block (spec 041)", () => {
  it("keeps the band and the margin on the page trim width, and the box on the face", () => {
    const faceW = 1040; // the face overhangs the block by 40
    const a = coverFaceAreas({ hasTitle: true, hasSubtitle: false, position: "bottom", w: faceW, h: H, unitW: W });
    expect(a.margin).toBe(M); // the page's margin, not the face's
    expect(a.band).toBe(COVER_TOP_TITLE * W);
    expect(a.sideMargin).toBe(SM); // the page's side margin, not the face's
    expect(a.photo.w).toBe(faceW - 2 * SM); // the box still spans the whole face
    expect(a.photo.y).toBe(M);
  });
});

// Issue #127: a 6% side margin left a printed cover photo pressed against the board edges.
// The sides are the only edges that moved.
describe("the side margin", () => {
  it("is wider than the outer one, and leaves the rest of the composition alone", () => {
    expect(COVER_SIDE_MARGIN).toBe(0.09);
    expect(COVER_SIDE_MARGIN).toBeGreaterThan(COVER_MARGIN);
    const a = coverFaceAreas({ hasTitle: true, hasSubtitle: false, position: "top", w: W, h: H });
    expect(a.margin).toBe(M);
    expect(a.text.inset).toBe(M);
    expect(a.band).toBe(COVER_TOP_TITLE * W);
    expect(H - (a.photo.y + a.photo.h)).toBe(M);
  });

  it("insets the photo area equally on the left and the right, in both positions", () => {
    for (const position of ["top", "bottom"] as const) {
      const a = coverFaceAreas({ hasTitle: true, hasSubtitle: true, position, w: W, h: H });
      expect(a.photo.x).toBe(SM);
      expect(W - (a.photo.x + a.photo.w)).toBe(SM);
    }
  });
});
