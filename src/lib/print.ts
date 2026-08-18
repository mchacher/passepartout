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
import { computeLayout, whitespaceToDensity } from "./layout";
import { resolveNode } from "./layouts";
import type { FontThemeId } from "./themes";

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

/** A placed photo box (already contain-fit, so w/h === the photo's ratio). */
export interface PhotoBox {
  photoId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A piece of text to draw, centered on `cx`, its top at `y`. */
export interface TextPlace {
  text: string;
  cx: number;
  y: number;
  sizePt: number;
}

export interface PageGeometry {
  mediaBox: PtRect; // whole page including bleed, origin (0,0)
  trimBox: PtRect; // the trim area within the media box
  contentBox: PtRect; // where photos live, trim inset by the page margin
  photos: PhotoBox[];
  title: TextPlace | null;
  subtitle: TextPlace | null;
  captions: TextPlace[];
}

// The page margin and header offsets mirror the on-screen Paper (percentages of the
// page width, matching CSS padding %). Keeping them identical makes preview == print.
const MARGIN = 0.07;
const TOP_TITLE = 0.13;
const TOP_SUBTITLE = 0.16;

// Text sizes as a fraction of the trim width, mirroring the on-screen cqw-based clamps
// (e.g. a page title is clamp(.., 3.1cqw, ..) = 3.1% of the page width). Multiplied by
// the project's text-size scale.
const F_PAGE_TITLE = 0.031;
const F_PAGE_SUBTITLE = 0.022;
const F_CAPTION = 0.018;
const F_COVER_TITLE = 0.05;
const F_COVER_SUBTITLE = 0.026;

export interface PageInput {
  size: BookSize;
  items: { photoId: string; ratio: number; caption: string }[];
  layoutId: string;
  whitespace: number;
  title: string;
  subtitle: string;
  /** Per-role text-size multipliers (see text-sizes.ts). */
  scales: { pageTitle: number; pageSubtitle: number; caption: number };
}

/** Geometry for one interior page (or an inside cover face rendered as a page). */
export function interiorPageGeometry(input: PageInput): PageGeometry {
  const trimW = mmToPt(input.size.widthMm);
  const trimH = mmToPt(input.size.heightMm);
  const bleed = mmToPt(BLEED_MM);

  const mediaBox: PtRect = { x: 0, y: 0, w: trimW + 2 * bleed, h: trimH + 2 * bleed };
  const trimBox: PtRect = { x: bleed, y: bleed, w: trimW, h: trimH };

  const hasTitle = input.title.trim().length > 0;
  const hasSubtitle = input.subtitle.trim().length > 0;
  const margin = MARGIN * trimW;
  const topMargin = (hasSubtitle ? TOP_SUBTITLE : hasTitle ? TOP_TITLE : MARGIN) * trimW;

  const contentBox: PtRect = {
    x: trimBox.x + margin,
    y: trimBox.y + topMargin,
    w: trimW - 2 * margin,
    h: trimH - topMargin - margin,
  };

  const node = resolveNode(input.layoutId, input.items.length);
  const { cells } = computeLayout(
    input.items.map((i) => ({ ratio: i.ratio })),
    contentBox.w,
    contentBox.h,
    node,
    { density: whitespaceToDensity(input.whitespace) },
  );

  const photos: PhotoBox[] = [];
  const captions: TextPlace[] = [];
  cells.forEach((c, i) => {
    // Center the photo in its region, exactly like Paper's flex centering.
    const x = contentBox.x + c.rx + (c.rw - c.w) / 2;
    const y = contentBox.y + c.ry + (c.rh - c.h) / 2;
    photos.push({ photoId: input.items[i].photoId, x, y, w: c.w, h: c.h });
    const caption = input.items[i].caption.trim();
    if (caption) {
      captions.push({
        text: caption,
        cx: x + c.w / 2,
        y: y + c.h + 0.01 * trimW,
        sizePt: F_CAPTION * trimW * input.scales.caption,
      });
    }
  });

  const centerX = trimBox.x + trimW / 2;
  const title = hasTitle
    ? { text: input.title.trim(), cx: centerX, y: trimBox.y + 0.054 * trimH, sizePt: F_PAGE_TITLE * trimW * input.scales.pageTitle }
    : null;
  const subtitle = hasSubtitle
    ? {
        text: input.subtitle.trim(),
        cx: centerX,
        y: trimBox.y + 0.054 * trimH + (title ? title.sizePt * 1.2 : 0),
        sizePt: F_PAGE_SUBTITLE * trimW * input.scales.pageSubtitle,
      }
    : null;

  return { mediaBox, trimBox, contentBox, photos, title, subtitle, captions };
}

export interface CoverPanel {
  /** The panel's trim rect within the wrap media box. */
  trimBox: PtRect;
  photo: PhotoBox | null;
  title: TextPlace | null;
  subtitle: TextPlace | null;
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
  const margin = 0.09 * trimW;
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
    // The photo lives below the header text, contained in the remaining area.
    const headerBottom = margin + (hasTitle ? titleSize * 1.4 : 0) + (hasSubtitle ? subtitleSize * 1.6 : 0);
    const area: PtRect = {
      x: trimBox.x + margin,
      y: trimBox.y + headerBottom + margin,
      w: trimBox.w - 2 * margin,
      h: trimBox.h - headerBottom - 2 * margin,
    };
    const { cells } = computeLayout([{ ratio: face.photo.ratio }], area.w, area.h, resolveNode("single", 1), {
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

  return { trimBox, photo, title, subtitle };
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

/** Map an album font to a standard PDF font family (no external font files). */
export function fontFamilyForTheme(fontTheme: FontThemeId): "serif" | "sans" | "mono" {
  if (fontTheme === "serif") return "serif";
  if (fontTheme === "typewriter") return "mono";
  return "sans";
}
