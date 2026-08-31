// Print geometry (pure, framework- and pdf-lib-free). Turns a project's pages and
// covers into positions and sizes in PDF points, reusing the same computeLayout the
// screen uses, so the printed page matches the preview and every photo stays
// contain-fit (never cropped). The impure painter (src/lib/pdf-export.ts) consumes
// this and draws it with pdf-lib.
//
// Coordinate space here is top-left origin, y-down (like the DOM and computeLayout).
// The painter flips y for pdf-lib's bottom-left origin. All lengths are PDF points
// (1 pt = 1/72 inch).

import type { BookSize } from "./book-sizes";
import { coverMediaIn, pageMediaIn, type CoverSpec, type PageSpec } from "./print-provider";
import { pageSpecOf } from "./print-providers";
import {
  F_COVER_SUBTITLE,
  F_COVER_TITLE,
  F_PAGE_SUBTITLE,
  F_PAGE_TITLE,
  PAGE_MARGIN,
  headerGeometry,
} from "./page-header";
import { computeLayout, drawOrder, PAGE_V_ALIGN, whitespaceToDensity } from "./layout";
import { coverFaceAreas, coverTextTop } from "./cover-layout";
import { resolveCells } from "./layouts";
import { fontThemeOrDefault, type FontThemeId } from "./themes";
import type { ShippedFontId } from "./fonts";
import {
  CARTOUCHE_PAD_X,
  CARTOUCHE_PAD_Y,
  NOTE_LINE,
  NOTE_REF_W,
  NOTE_TRACKING,
  RULE_GAP,
  RULE_WEIGHT,
  noteFontSize,
} from "./notes";
import { DEFAULT_CROP_FOCUS, type CellRect, type CoverTextPosition, type CropFocus, type Note, type NoteAlign, type NoteInkId, type PageFill } from "../types";

export const PT_PER_MM = 72 / 25.4;
export const mmToPt = (mm: number) => mm * PT_PER_MM;
export const inToPt = (inch: number) => inch * 72;

/** A rectangle in top-left / y-down point space. */
export interface PtRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A placed photo box. Contain boxes are already contain-fit (w/h === the photo's ratio);
 * a `cover` box is the full page and the painter crops the source to it at `focus`. */
export interface PhotoBox {
  photoId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** True for a full-page Fill photo: the painter cover-crops the source into this box. */
  cover?: boolean;
  /** Crop focus for a `cover` box (defaults to centered). */
  focus?: CropFocus;
}

/** A piece of text to draw, centered on `cx`, its top at `y`. */
export interface TextPlace {
  text: string;
  cx: number;
  y: number;
  sizePt: number;
  // Decorative tilt (spec 020): when set, the painter rotates this text about (cx0, cy0) by
  // `deg` on-screen clockwise degrees, so a caption tilts as one unit with its photo (#5).
  rot?: { deg: number; cx0: number; cy0: number };
}

/**
 * A note ready to paint (spec 039). Everything is in points except the wrapping, which the
 * painter does at the CANONICAL reference size: it wraps `text` to `wrapW` using `refSize`,
 * then draws the resulting lines at `sizePt`. That is what makes the printed note break its
 * lines at exactly the same words as the editor and the book preview, whatever the book size
 * and whatever the zoom (see NOTE_REF_W in src/lib/notes.ts).
 */
export interface NotePlace {
  text: string;
  /** The note box's centre, in the media box's coordinate space. */
  cx: number;
  cy: number;
  /** The box width in points (the paper width the wrap corresponds to). */
  w: number;
  sizePt: number;
  lineHeightPt: number;
  /** Wrapping inputs, in the canonical reference units. */
  wrapW: number;
  refSize: number;
  font: ShippedFontId;
  bold: boolean;
  italic: boolean;
  align: NoteAlign;
  ink: NoteInkId;
  customInk?: string;
  /** Uppercase plus tracking; `trackingPt` is added after every character, as CSS does. */
  caps: boolean;
  trackingPt: number;
  refTrackingPt: number;
  rule: "over" | "under" | null;
  opacity: number;
  cartouche: boolean;
  padXPt: number;
  padYPt: number;
  ruleGapPt: number;
  ruleWeightPt: number;
  /** Decorative tilt in on-screen clockwise degrees, about the note's centre. */
  rotation: number;
}

/**
 * Place a container's notes inside its trim box. A note is an overlay: this function reads
 * nothing from the photos and writes nothing back, so adding one cannot move a photo. An
 * empty note prints nothing at all.
 */
export function notePlaces(notes: Note[] | undefined, trimBox: PtRect): NotePlace[] {
  if (!notes || notes.length === 0) return [];
  const out: NotePlace[] = [];
  for (const n of notes) {
    if (n.text.trim().length === 0) continue;
    const sizePt = noteFontSize(n.size, trimBox.w);
    const refSize = noteFontSize(n.size, NOTE_REF_W);
    out.push({
      text: n.caps ? n.text.toUpperCase() : n.text,
      cx: trimBox.x + n.x * trimBox.w,
      cy: trimBox.y + n.y * trimBox.h,
      w: n.w * trimBox.w,
      sizePt,
      lineHeightPt: sizePt * NOTE_LINE,
      wrapW: n.w * NOTE_REF_W,
      refSize,
      font: n.font,
      bold: n.bold === true,
      italic: n.italic === true,
      align: n.align,
      ink: n.ink,
      customInk: n.customInk,
      caps: n.caps === true,
      trackingPt: n.caps ? NOTE_TRACKING * sizePt : 0,
      refTrackingPt: n.caps ? NOTE_TRACKING * refSize : 0,
      rule: n.rule ?? null,
      opacity: n.opacity ?? 1,
      cartouche: n.cartouche === true,
      padXPt: n.cartouche ? CARTOUCHE_PAD_X * sizePt : 0,
      padYPt: n.cartouche ? CARTOUCHE_PAD_Y * sizePt : 0,
      ruleGapPt: RULE_GAP * sizePt,
      ruleWeightPt: RULE_WEIGHT * sizePt,
      rotation: n.rotation ?? 0,
    });
  }
  return out;
}

/**
 * Which edge of a page binds into the gutter. Blurb adds the bleed to the top, the bottom and
 * the OUTSIDE edge only, never the binding edge, so a page's media box is asymmetric and which
 * side carries the extra 1/8 inch depends on whether the sheet is a recto or a verso (spec 041).
 * A right-hand page binds on its left, so its bleed is on the right.
 */
export type BindingSide = "left" | "right";

/** The page media box and the trim inside it, per Blurb's asymmetric bleed rule. */
export function pageBoxes(size: BookSize, bindingSide: BindingSide): { mediaBox: PtRect; trimBox: PtRect } {
  const trimW = mmToPt(size.widthMm);
  const trimH = mmToPt(size.heightMm);
  const spec = pageSpec(size);
  const media = pageMediaIn(spec);
  const bleed = inToPt(spec.bleedIn);
  const mediaBox: PtRect = { x: 0, y: 0, w: inToPt(media.w), h: inToPt(media.h) };
  // The horizontal bleed belongs on the OUTSIDE edge, so the trim sits flush against the
  // binding one. With a provider that bleeds all four edges there is one on each side.
  const gutterBleed = spec.bleedEdges === "all" ? bleed : 0;
  const outerLeft = bindingSide === "right" ? bleed : gutterBleed;
  const trimBox: PtRect = { x: outerLeft, y: bleed, w: trimW, h: trimH };
  return { mediaBox, trimBox };
}

/** The provider's page specification for a size. Every catalog size has one. */
export function pageSpec(size: BookSize): PageSpec {
  const spec = pageSpecOf(size.provider, size.id);
  if (!spec) throw new Error(`no ${size.provider} page specification for ${size.id}`);
  return spec;
}

export interface PageGeometry {
  mediaBox: PtRect; // whole page including bleed, origin (0,0)
  trimBox: PtRect; // the trim area within the media box
  contentBox: PtRect; // where photos live, trim inset by the page margin
  photos: PhotoBox[];
  title: TextPlace | null;
  subtitle: TextPlace | null;
  captions: TextPlace[];
  /** Freely placed notes (spec 039), painted over the photos. */
  notes: NotePlace[];
}

// The interior page margin and the header band come from src/lib/page-header.ts, the one
// rule the editor and the book preview render from too (spec 036). Nothing to keep in sync
// by hand any more: preview == print by construction.
const MARGIN = PAGE_MARGIN;

// Cover face geometry lives in cover-layout.ts: the fixed band, the margin, and which side
// of the photo the text sits on (spec 042). The same module is read by CoverCard and by the
// book preview for their CSS, so the three renderers cannot drift.

// Text sizes as a fraction of the trim width, mirroring the on-screen cqw-based clamps
// (e.g. a page title is clamp(.., 3.1cqw, ..) = 3.1% of the page width). Multiplied by
// the project's text-size scale. The two page fractions live in page-header.ts, which also
// derives the band they sit in.
const F_CAPTION = 0.018;

export interface PageInput {
  size: BookSize;
  items: { photoId: string; ratio: number; caption: string; rotation?: number }[];
  layoutId: string;
  whitespace: number;
  title: string;
  subtitle: string;
  /** Per-role text-size multipliers (see text-sizes.ts). */
  scales: { pageTitle: number; pageSubtitle: number; caption: number };
  /** Full-page mode for a single-photo page (spec 012); undefined = a normal page. */
  fullPage?: PageFill;
  /** Crop focus for `cover` full-page mode (defaults to centered). */
  focus?: CropFocus;
  /** Custom grid placement (spec 013); overrides the named template when valid. */
  placement?: CellRect[];
  /** Freely placed notes (spec 039). */
  notes?: Note[];
  /** Which edge binds into the gutter; the bleed goes on the other one. Defaults to a recto. */
  bindingSide?: BindingSide;
}

/** Geometry for one interior page (or an inside cover face rendered as a page). */
export function interiorPageGeometry(input: PageInput): PageGeometry {
  const trimW = mmToPt(input.size.widthMm);
  const trimH = mmToPt(input.size.heightMm);

  const { mediaBox, trimBox } = pageBoxes(input.size, input.bindingSide ?? "left");

  // Full-page photo (spec 012): the single photo owns the whole media box (into the bleed)
  // and there is no page text. Contain keeps the ratio (paper bands where it differs);
  // cover fills the box and is cropped by the painter. Never distorted either way.
  const one = input.items[0];
  if (input.fullPage && input.items.length === 1 && one) {
    let photo: PhotoBox;
    if (input.fullPage === "cover") {
      photo = {
        photoId: one.photoId,
        x: 0,
        y: 0,
        w: mediaBox.w,
        h: mediaBox.h,
        cover: true,
        focus: input.focus ?? DEFAULT_CROP_FOCUS,
      };
    } else {
      const boxH = Math.min(mediaBox.h, mediaBox.w / one.ratio);
      const boxW = boxH * one.ratio;
      photo = {
        photoId: one.photoId,
        x: (mediaBox.w - boxW) / 2,
        y: (mediaBox.h - boxH) / 2,
        w: boxW,
        h: boxH,
      };
    }
    // A full-page photo has no page text, but it does carry its notes: writing across a
    // full-bleed photo is exactly what a note is for.
    return {
      mediaBox,
      trimBox,
      contentBox: { ...mediaBox },
      photos: [photo],
      title: null,
      subtitle: null,
      captions: [],
      notes: notePlaces(input.notes, trimBox),
    };
  }

  const hasTitle = input.title.trim().length > 0;
  const hasSubtitle = input.subtitle.trim().length > 0;
  // Print draws the header at its pure fraction of the trim (no readability clamp: the page
  // is the page). The band comes from the same rule the editor renders from (spec 036).
  const titlePt = hasTitle ? F_PAGE_TITLE * trimW * input.scales.pageTitle : 0;
  const subtitlePt = hasSubtitle ? F_PAGE_SUBTITLE * trimW * input.scales.pageSubtitle : 0;
  const header = headerGeometry({ titleSize: titlePt, subtitleSize: subtitlePt, pageW: trimW, pageH: trimH });
  const margin = MARGIN * trimW;
  const topMargin = header.band;

  const contentBox: PtRect = {
    x: trimBox.x + margin,
    y: trimBox.y + topMargin,
    w: trimW - 2 * margin,
    h: trimH - topMargin - margin,
  };

  const gridCells = resolveCells(input.layoutId, input.items.length, input.placement);
  const { cells } = computeLayout(
    input.items.map((i) => ({ ratio: i.ratio })),
    contentBox.w,
    contentBox.h,
    gridCells,
    { density: whitespaceToDensity(input.whitespace), vAlign: PAGE_V_ALIGN },
  );

  const photos: PhotoBox[] = [];
  const captions: TextPlace[] = [];
  // Emit in draw order so overlapping custom placements (spec 013 Phase B) layer like the
  // editor: the painter draws photos in array order, so back-to-front here == on screen.
  for (const i of drawOrder(gridCells)) {
    const c = cells[i];
    if (!c) continue;
    // Position the photo in its region by the cell's anchor (ox/oy), like Paper.
    const x = contentBox.x + c.rx + c.ox;
    const y = contentBox.y + c.ry + c.oy;
    photos.push({ photoId: input.items[i].photoId, x, y, w: c.w, h: c.h });
    const caption = input.items[i].caption.trim();
    if (caption) {
      // A tilted photo tilts its caption with it (spec 020, #5): rotate the caption about the
      // photo box center, the same pivot the photo (and any frame) uses.
      const deg = input.items[i].rotation ?? 0;
      captions.push({
        text: caption,
        cx: x + c.w / 2,
        y: y + c.h + 0.01 * trimW,
        sizePt: F_CAPTION * trimW * input.scales.caption,
        rot: deg ? { deg, cx0: x + c.w / 2, cy0: y + c.h / 2 } : undefined,
      });
    }
  }

  // TextPlace.y is the GLYPH top, which is what headerGeometry reports: it adds the
  // half-leading a browser applies from line-height, so the PDF and the on-screen page sit
  // on the same baselines (spec 036).
  const centerX = trimBox.x + trimW / 2;
  const title = hasTitle
    ? { text: input.title.trim(), cx: centerX, y: trimBox.y + header.titleGlyphTop, sizePt: titlePt }
    : null;
  const subtitle = hasSubtitle
    ? { text: input.subtitle.trim(), cx: centerX, y: trimBox.y + header.subtitleGlyphTop, sizePt: subtitlePt }
    : null;

  return { mediaBox, trimBox, contentBox, photos, title, subtitle, captions, notes: notePlaces(input.notes, trimBox) };
}

/** One inside cover face, printed as a page of the interior file (issue 71). */
export interface InsideCoverPageInput {
  size: BookSize;
  title: string;
  subtitle: string;
  whitespace: number;
  photo?: { photoId: string; ratio: number };
  /** Which side of the photo the text sits on (spec 042); absent = above it. */
  textPosition?: CoverTextPosition;
  /** Cover text multipliers: an inside face is a COVER, not a page (issue 71). */
  scales: { coverTitle: number; coverSubtitle: number };
  /** Freely placed notes (spec 039). */
  notes?: Note[];
  /** Which edge binds into the gutter; the bleed goes on the other one. */
  bindingSide?: BindingSide;
}

/**
 * Geometry for an inside cover face. It lives in the interior PDF, so it is a page-sized
 * sheet with bleed, but it is drawn with the COVER rules: cover font fractions, cover text
 * scales and the fixed cover band, exactly like `CoverCard` on screen and the book preview's
 * cover leaf. Routing it through `interiorPageGeometry` instead is what made the printed
 * inside faces disagree with the editor (issue 71): page fractions, page scales, and since
 * spec 036 a band that followed the page text sizes.
 */
export function insideCoverPageGeometry(input: InsideCoverPageInput): PageGeometry {
  const trimW = mmToPt(input.size.widthMm);
  const trimH = mmToPt(input.size.heightMm);
  const { mediaBox, trimBox } = pageBoxes(input.size, input.bindingSide ?? "left");

  const panel = coverPanel(
    {
      title: input.title,
      subtitle: input.subtitle,
      whitespace: input.whitespace,
      photo: input.photo ?? null,
      textPosition: input.textPosition,
      notes: input.notes,
    },
    trimBox,
    trimW,
    input.scales,
  );

  const areas = coverFaceAreas({
    hasTitle: input.title.trim().length > 0,
    hasSubtitle: input.subtitle.trim().length > 0,
    position: input.textPosition,
    w: trimW,
    h: trimH,
  });
  const contentBox: PtRect = {
    x: trimBox.x + areas.photo.x,
    y: trimBox.y + areas.photo.y,
    w: areas.photo.w,
    h: areas.photo.h,
  };

  return {
    mediaBox,
    trimBox,
    contentBox,
    photos: panel.photo ? [panel.photo] : [],
    title: panel.title,
    subtitle: panel.subtitle,
    captions: [],
    notes: panel.notes,
  };
}

export interface CoverPanel {
  /** The panel's trim rect within the wrap media box. */
  trimBox: PtRect;
  photo: PhotoBox | null;
  title: TextPlace | null;
  subtitle: TextPlace | null;
  /** Freely placed notes on this face (spec 039). */
  notes: NotePlace[];
}

export interface CoverGeometry {
  mediaBox: PtRect;
  back: CoverPanel;
  front: CoverPanel;
  /** The spine panel's trim rect (between back and front). */
  spineBox: PtRect;
  /** Vertical spine text lines (title, optionally a subtitle), drawn rotated by the
   * painter. Empty when there is no title. */
  spineLines: TextPlace[];
}

export interface CoverFaceInput {
  title: string;
  subtitle: string;
  photo: { photoId: string; ratio: number } | null;
  whitespace: number;
  /** Which side of the photo the text sits on (spec 042); absent = above it. */
  textPosition?: CoverTextPosition;
  /** Freely placed notes (spec 039). */
  notes?: Note[];
}

export interface CoverWrapInput {
  size: BookSize;
  /** The construction being printed: it decides the overhang, the bleed and the flaps. */
  cover: CoverSpec;
  spineWidthPt: number;
  front: CoverFaceInput;
  back: CoverFaceInput;
  spineTitle: string;
  /** Optional second spine line; empty to print the title alone. */
  spineSubtitle: string;
  scales: { coverTitle: number; coverSubtitle: number };
}

// One outside cover face: title + subtitle at the top, the optional photo contained in
// the area below (a single-slot layout, like CoverCard). An approximation of the
// on-screen cover, faithful enough for print and always contain-fit.
function coverPanel(
  face: CoverFaceInput,
  trimBox: PtRect,
  trimW: number,
  scales: { coverTitle: number; coverSubtitle: number },
): CoverPanel {
  const hasTitle = face.title.trim().length > 0;
  const hasSubtitle = face.subtitle.trim().length > 0;
  const centerX = trimBox.x + trimBox.w / 2;
  // The band, the margin and the photo's area come from the one module that decides them.
  // Their fractions are of the PAGE trim width even when the face overhangs it (spec 041).
  const areas = coverFaceAreas({
    hasTitle,
    hasSubtitle,
    position: face.textPosition,
    w: trimBox.w,
    h: trimBox.h,
    unitW: trimW,
  });

  const titleSize = F_COVER_TITLE * trimW * scales.coverTitle;
  const subtitleSize = F_COVER_SUBTITLE * trimW * scales.coverSubtitle;
  // The subtitle keeps its offset under the title, so the block is one line or two. At the top
  // it hangs one margin below the edge; at the bottom its last line lands one margin above the
  // opposite edge (spec 042).
  const subtitleOffset = titleSize * 1.4;
  const blockH = hasSubtitle ? subtitleOffset + subtitleSize * 1.4 : titleSize * 1.4;
  const textTop = trimBox.y + coverTextTop(areas, trimBox.h, blockH);
  const title = hasTitle ? { text: face.title.trim(), cx: centerX, y: textTop, sizePt: titleSize } : null;
  const subtitle = hasSubtitle
    ? { text: face.subtitle.trim(), cx: centerX, y: textTop + subtitleOffset, sizePt: subtitleSize }
    : null;

  let photo: PhotoBox | null = null;
  if (face.photo) {
    const area: PtRect = {
      x: trimBox.x + areas.photo.x,
      y: trimBox.y + areas.photo.y,
      w: areas.photo.w,
      h: areas.photo.h,
    };
    const { cells } = computeLayout([{ ratio: face.photo.ratio }], area.w, area.h, resolveCells("single", 1), {
      density: whitespaceToDensity(face.whitespace),
    });
    const c = cells[0];
    if (c) {
      photo = {
        photoId: face.photo.photoId,
        x: area.x + c.rx + (c.rw - c.w) / 2,
        y: area.y + c.ry + (c.rh - c.h) / 2,
        w: c.w,
        h: c.h,
      };
    }
  }

  return { trimBox, photo, title, subtitle, notes: notePlaces(face.notes, trimBox) };
}

/**
 * Geometry for the cover wrap: back (left) + spine + front (right), with bleed.
 *
 * Unlike a page, a cover bleeds on all four sides, and its faces are not always the size of a
 * page: an ImageWrap hardcover overhangs its block on every edge, a dust jacket carries a flap
 * at each end, a softcover trims flush (spec 041). The wrap laid flat, left to right, is
 * [flap] [back] [spine] [front] [flap].
 */
export function coverWrapGeometry(input: CoverWrapInput): CoverGeometry {
  const pageTrimW = mmToPt(input.size.widthMm);
  const pageTrimH = mmToPt(input.size.heightMm);
  const spec = input.cover;
  const bleed = inToPt(spec.bleedIn);
  const flap = inToPt(spec.flapIn);
  const spine = input.spineWidthPt;

  const faceW = pageTrimW + inToPt(spec.overhangIn.w);
  const faceH = pageTrimH + 2 * inToPt(spec.overhangIn.h);
  const media = coverMediaIn(pageSpec(input.size), spec, spine / 72);
  const mediaBox: PtRect = { x: 0, y: 0, w: inToPt(media.w), h: inToPt(media.h) };

  const backX = bleed + flap;
  const backBox: PtRect = { x: backX, y: bleed, w: faceW, h: faceH };
  const spineBox: PtRect = { x: backX + faceW, y: bleed, w: spine, h: faceH };
  const frontBox: PtRect = { x: backX + faceW + spine, y: bleed, w: faceW, h: faceH };

  // Text keeps sizing off the PAGE trim width, not the face: that is the fraction the editor
  // and the book preview render from, so the printed cover reads like the previewed one even
  // when the face overhangs the block.
  const back = coverPanel(input.back, backBox, pageTrimW, input.scales);
  const front = coverPanel(input.front, frontBox, pageTrimW, input.scales);

  // Spine text runs along the spine length (rotated); each line's cap height must fit
  // within the spine width. With a subtitle the width is shared by two parallel lines.
  const title = input.spineTitle.trim();
  const subtitle = input.spineSubtitle.trim();
  const cy = spineBox.y + spineBox.h / 2;
  const titleCap = F_COVER_TITLE * pageTrimW * input.scales.coverTitle;
  const subtitleCap = F_COVER_SUBTITLE * pageTrimW * input.scales.coverSubtitle;
  const spineLines: TextPlace[] = [];
  if (title && subtitle) {
    spineLines.push({ text: title, cx: spineBox.x + spineBox.w * 0.34, y: cy, sizePt: Math.min(spine * 0.42, titleCap) });
    spineLines.push({ text: subtitle, cx: spineBox.x + spineBox.w * 0.68, y: cy, sizePt: Math.min(spine * 0.26, subtitleCap) });
  } else if (title) {
    spineLines.push({ text: title, cx: spineBox.x + spineBox.w / 2, y: cy, sizePt: Math.min(spine * 0.72, titleCap) });
  }

  return { mediaBox, back, front, spineBox, spineLines };
}

// ---------------------------------------------------------------------------
// Paper + spine width
// ---------------------------------------------------------------------------

export type PaperId = "standard" | "premium-lustre" | "premium-matte";

export interface Paper {
  id: PaperId;
  name: string;
  /** Approximate caliper per page in mm; the exact spine comes from Blurb's spec tool. */
  mmPerPage: number;
}

export const PAPERS: Paper[] = [
  { id: "standard", name: "Standard", mmPerPage: 0.13 },
  { id: "premium-lustre", name: "Premium Lustre", mmPerPage: 0.2 },
  { id: "premium-matte", name: "Premium Matte", mmPerPage: 0.2 },
];

export const DEFAULT_PAPER: PaperId = "standard";

// The cover/binding contribution to the spine (boards, endsheets, wrap). Without it a
// low-page book estimates a sub-millimetre spine and the title prints microscopically.
// A real hardcover photo book is a few mm even at low page counts.
export const SPINE_COVER_MM = 3;

export function paperOrDefault(id: string | undefined | null): Paper {
  return PAPERS.find((p) => p.id === id) ?? PAPERS.find((p) => p.id === DEFAULT_PAPER)!;
}

/**
 * A rough spine-width estimate (mm) from the interior page count, the paper caliper, and
 * a cover/binding allowance. Monotonic in page count. Blurb's spec tool gives the exact
 * value; the UI lets the user override this.
 */
export function estimateSpineMm(interiorPageCount: number, paperId: string): number {
  const paper = paperOrDefault(paperId);
  return SPINE_COVER_MM + Math.max(0, interiorPageCount) * paper.mmPerPage;
}

/**
 * The shipped family an album style is set in (spec 040). The painter embeds that file, so
 * the printed album text is the previewed album text. This replaced a mapping onto the three
 * standard PDF families, which is why an album used to print in Times or Helvetica whatever
 * style it was set in (issue #99).
 */
export function albumFontFamily(fontTheme: FontThemeId): ShippedFontId {
  return fontThemeOrDefault(fontTheme).family;
}
