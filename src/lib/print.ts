// Print geometry (pure, framework- and pdf-lib-free). Turns a project's pages and
// covers into positions and sizes in PDF points, reusing the same computeLayout the
// screen uses, so the printed page matches the preview and every photo stays
// contain-fit (never cropped). The impure painter (src/lib/pdf-export.ts) consumes
// this and draws it with pdf-lib.
//
// Coordinate space here is top-left origin, y-down (like the DOM and computeLayout).
// The painter flips y for pdf-lib's bottom-left origin. All lengths are PDF points
// (1 pt = 1/72 inch).

import { BLEED_MM, type BookSize } from "./book-sizes";
import {
  F_COVER_SUBTITLE,
  F_COVER_TITLE,
  F_PAGE_SUBTITLE,
  F_PAGE_TITLE,
  PAGE_MARGIN,
  headerGeometry,
} from "./page-header";
import { computeLayout, drawOrder, whitespaceToDensity } from "./layout";
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
import { DEFAULT_CROP_FOCUS, type CellRect, type CropFocus, type Note, type NoteAlign, type NoteInkId, type PageFill } from "../types";

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

// Cover face geometry, all fractions of the trim width and mirrored by the CSS % on
// CoverCard / PreviewPaper. Like the interior pages, the header lives in a FIXED top
// band and the photo fills the area below it: the band height depends only on whether a
// title / subtitle is present, never on the font-size level, so enlarging the title no
// longer shrinks the photo, and a cover with no subtitle gives that space back to the
// photo at every font size. COVER_MARGIN is the side / bottom inset (and the top inset
// when there is no text at all).
const COVER_MARGIN = 0.06;
const COVER_TOP_TITLE = 0.15; // reserved top band for a title alone
const COVER_TOP_SUBTITLE = 0.2; // reserved top band for a title + subtitle

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
}

/** Geometry for one interior page (or an inside cover face rendered as a page). */
export function interiorPageGeometry(input: PageInput): PageGeometry {
  const trimW = mmToPt(input.size.widthMm);
  const trimH = mmToPt(input.size.heightMm);
  const bleed = mmToPt(BLEED_MM);

  const mediaBox: PtRect = { x: 0, y: 0, w: trimW + 2 * bleed, h: trimH + 2 * bleed };
  const trimBox: PtRect = { x: bleed, y: bleed, w: trimW, h: trimH };

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
    { density: whitespaceToDensity(input.whitespace) },
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
  /** Cover text multipliers: an inside face is a COVER, not a page (issue 71). */
  scales: { coverTitle: number; coverSubtitle: number };
  /** Freely placed notes (spec 039). */
  notes?: Note[];
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
  const bleed = mmToPt(BLEED_MM);
  const mediaBox: PtRect = { x: 0, y: 0, w: trimW + 2 * bleed, h: trimH + 2 * bleed };
  const trimBox: PtRect = { x: bleed, y: bleed, w: trimW, h: trimH };

  const panel = coverPanel(
    {
      title: input.title,
      subtitle: input.subtitle,
      whitespace: input.whitespace,
      photo: input.photo ?? null,
      notes: input.notes,
    },
    trimBox,
    trimW,
    input.scales,
  );

  const hasTitle = input.title.trim().length > 0;
  const hasSubtitle = input.subtitle.trim().length > 0;
  const margin = COVER_MARGIN * trimW;
  const topBand = (hasSubtitle ? COVER_TOP_SUBTITLE : hasTitle ? COVER_TOP_TITLE : COVER_MARGIN) * trimW;
  const contentBox: PtRect = {
    x: trimBox.x + margin,
    y: trimBox.y + topBand,
    w: trimW - 2 * margin,
    h: trimH - topBand - margin,
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
  /** Freely placed notes (spec 039). */
  notes?: Note[];
}

export interface CoverWrapInput {
  size: BookSize;
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
  const margin = COVER_MARGIN * trimW;
  const hasTitle = face.title.trim().length > 0;
  const hasSubtitle = face.subtitle.trim().length > 0;
  const centerX = trimBox.x + trimBox.w / 2;

  const titleSize = F_COVER_TITLE * trimW * scales.coverTitle;
  const subtitleSize = F_COVER_SUBTITLE * trimW * scales.coverSubtitle;
  const title = hasTitle
    ? { text: face.title.trim(), cx: centerX, y: trimBox.y + margin, sizePt: titleSize }
    : null;
  const subtitle = hasSubtitle
    ? { text: face.subtitle.trim(), cx: centerX, y: trimBox.y + margin + titleSize * 1.4, sizePt: subtitleSize }
    : null;

  let photo: PhotoBox | null = null;
  if (face.photo) {
    // The header sits in a FIXED top band (like the interior pages): its height depends
    // only on whether a title / subtitle is present, not on the font size. The photo
    // fills the area below, so enlarging the title never shrinks it and a subtitle-less
    // cover gives that band back to the photo.
    const topBand = (hasSubtitle ? COVER_TOP_SUBTITLE : hasTitle ? COVER_TOP_TITLE : COVER_MARGIN) * trimW;
    const area: PtRect = {
      x: trimBox.x + margin,
      y: trimBox.y + topBand,
      w: trimBox.w - 2 * margin,
      h: trimBox.h - topBand - margin,
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

/** Geometry for the cover wrap: back (left) + spine + front (right), with bleed. */
export function coverWrapGeometry(input: CoverWrapInput): CoverGeometry {
  const trimW = mmToPt(input.size.widthMm);
  const trimH = mmToPt(input.size.heightMm);
  const bleed = mmToPt(BLEED_MM);
  const spine = input.spineWidthPt;

  const wrapW = 2 * trimW + spine;
  const mediaBox: PtRect = { x: 0, y: 0, w: wrapW + 2 * bleed, h: trimH + 2 * bleed };

  const backBox: PtRect = { x: bleed, y: bleed, w: trimW, h: trimH };
  const spineBox: PtRect = { x: bleed + trimW, y: bleed, w: spine, h: trimH };
  const frontBox: PtRect = { x: bleed + trimW + spine, y: bleed, w: trimW, h: trimH };

  const back = coverPanel(input.back, backBox, trimW, input.scales);
  const front = coverPanel(input.front, frontBox, trimW, input.scales);

  // Spine text runs along the spine length (rotated); each line's cap height must fit
  // within the spine width. With a subtitle the width is shared by two parallel lines.
  const title = input.spineTitle.trim();
  const subtitle = input.spineSubtitle.trim();
  const cy = spineBox.y + spineBox.h / 2;
  const titleCap = F_COVER_TITLE * trimW * input.scales.coverTitle;
  const subtitleCap = F_COVER_SUBTITLE * trimW * input.scales.coverSubtitle;
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
