// Print PDF builder (impure, browser-only). Paints the pure print geometry
// (src/lib/print.ts) with pdf-lib: the album paper bleeds to the media-box edge, each
// photo is re-encoded to a 300 DPI sRGB JPEG at its exact contain-fit box (never
// cropped) and embedded, and titles / subtitles / captions / the spine are drawn as
// vector text. Produces two files matching Blurb's split: an interior PDF (inside
// front, pages, inside back) and a cover-wrap PDF (back + spine + front).

import { PDFDocument, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { shippedFontFace, supportedText, type ShippedFontId } from "./fonts";
import { measureTracked, noteInk, wrapLines, type NotePalette } from "./notes";
import { type BookSize } from "./book-sizes";
import { colorThemeOrDefault, type ColorThemeId, type FontThemeId } from "./themes";
import { type TextSizes } from "./text-sizes";
import { coverSourceRect } from "./fit";
import { maskById } from "./masks";
import { frameById, frameColorOf, frameInner, squareCrop, borderWidthOf } from "./frames";
import { DEFAULT_CROP_FOCUS, type CellRect, type CropFocus, type CropRect, type Note, type PageFill } from "../types";
import {
  coverWrapGeometry,
  albumFontFamily,
  insideCoverPageGeometry,
  interiorPageGeometry,
  type BindingSide,
  type CoverFaceInput,
  mmToPt,
  notePlaces,
  type NotePlace,
  type PageGeometry,
  type PhotoBox,
  type PtRect,
  type TextPlace,
} from "./print";

const PRINT_DPI = 300;

export interface ExportPageLike {
  title: string;
  subtitle: string;
  whitespace: number;
  /**
   * An inside cover face printed as a page of the interior file (issue 71). It is drawn with
   * the COVER rules (cover fractions, cover text scales, the fixed cover band), like the
   * editor and the book preview draw it, instead of as an ordinary interior page.
   */
  insideCover?: boolean;
  /** Freely placed notes on this page or inside cover face (spec 039). */
  notes?: Note[];
  layoutId: string;
  items: {
    photoId: string;
    // `ratio` is the LAYOUT ratio (the frame's outer ratio when framed); `photoRatio` is the
    // photo's effective ratio (Border contain) and `sourceRatio` its native ratio (Polaroid).
    ratio: number;
    photoRatio: number;
    sourceRatio: number;
    url: string;
    caption: string;
    crop?: CropRect;
    mask?: string;
    frame?: string;
    frameColor?: string;
    frameText?: string;
    frameWidth?: number;
    frameFocus?: CropFocus;
    rotation?: number;
  }[];
  /** Full-page mode for a single-photo page (spec 012). */
  fullPage?: PageFill;
  /** Crop focus for `cover` full-page mode. */
  focus?: CropFocus;
  /** Custom grid placement (spec 013). */
  placement?: CellRect[];
}

export interface ExportCoverFace {
  title: string;
  subtitle: string;
  whitespace: number;
  photo: { photoId: string; ratio: number; url: string; crop?: CropRect } | null;
  /** Freely placed notes on this face (spec 039). */
  notes?: Note[];
}

export interface ExportProject {
  name: string;
  size: BookSize;
  colorTheme: ColorThemeId;
  fontTheme: FontThemeId;
  textSizes: TextSizes;
  spineTitle: string;
  /** Optional second spine line (the cover subtitle); empty for title-only. */
  spineSubtitle: string;
  /** insideFront, then every content page, then insideBack. */
  interior: ExportPageLike[];
  front: ExportCoverFace;
  back: ExportCoverFace;
}

interface Palette {
  paper: [number, number, number];
  ink: [number, number, number];
  inkSoft: [number, number, number];
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function paletteOf(colorTheme: ColorThemeId): Palette {
  const c = colorThemeOrDefault(colorTheme);
  return { paper: hexToRgb(c.paper), ink: hexToRgb(c.ink), inkSoft: hexToRgb(c.inkSoft) };
}

const loadImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image decode failed"));
    img.src = url;
  });

// Re-encode a photo to an sRGB JPEG sized to its print box at 300 DPI. For a normal
// (contain) box the box already carries the photo's own ratio, so drawing it to fill the
// canvas keeps the aspect and never crops. For a `cover` full-page box (spec 012) the box
// is the page ratio: the source is centre/focus-cropped to that ratio here (9-arg
// drawImage), so the JPEG fills the box with no distortion and only the overflow dropped.
async function photoJpegBytes(
  url: string,
  boxWpt: number,
  boxHpt: number,
  cover?: { focus: CropFocus },
  crop?: CropRect,
  mask?: string,
): Promise<{ bytes: Uint8Array; png: boolean } | null> {
  let img: HTMLImageElement;
  try {
    img = await loadImage(url);
  } catch {
    return null;
  }
  const pxW = Math.max(1, Math.round((boxWpt / 72) * PRINT_DPI));
  const pxH = Math.max(1, Math.round((boxHpt / 72) * PRINT_DPI));
  const canvas = document.createElement("canvas");
  canvas.width = pxW;
  canvas.height = pxH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  // Decorative mask (spec 018): clip the canvas to the shape (scaled from its normalized
  // objectBoundingBox path to pixels) before drawing, so the area outside is transparent.
  const shape = mask ? maskById(mask) : undefined;
  if (shape) {
    const p = new Path2D();
    p.addPath(new Path2D(shape.path), new DOMMatrix([pxW, 0, 0, pxH, 0, 0]));
    ctx.clip(p);
  }
  if (cover) {
    // Full-page Fill (spec 012): cover-crop to the box ratio at the focus.
    const s = coverSourceRect(nw, nh, boxWpt / boxHpt, cover.focus);
    ctx.drawImage(img, s.sx, s.sy, s.sw, s.sh, 0, 0, pxW, pxH);
  } else if (crop) {
    // Photo crop (spec 015): draw only the kept source rectangle into the box (contain).
    ctx.drawImage(img, crop.x * nw, crop.y * nh, crop.w * nw, crop.h * nh, 0, 0, pxW, pxH);
  } else {
    ctx.drawImage(img, 0, 0, pxW, pxH);
  }
  // A masked photo needs transparency outside the shape, so encode PNG; otherwise JPEG.
  const blob = await new Promise<Blob | null>((res) =>
    shape ? canvas.toBlob(res, "image/png") : canvas.toBlob(res, "image/jpeg", 0.92),
  );
  if (!blob) return null;
  return { bytes: new Uint8Array(await blob.arrayBuffer()), png: !!shape };
}

/**
 * An embedded face: the pdf-lib font to draw with, and what it can actually draw. The
 * coverage predicate comes from the same bytes, because a TrueType face paints an unmapped
 * code point as a visible .notdef box instead of failing (see `supportedText`).
 */
interface Face {
  pdf: PDFFont;
  has: (codePoint: number) => boolean;
}

interface Ctx {
  page: PDFPage;
  mediaH: number;
  font: Face;
  palette: Palette;
  // Handwriting font for a frame's note (spec 019); absent on the cover wrap (no frames),
  // and absent too if its file could not be read, which must not stop the rest of the book.
  hand?: Face;
}

// A decorative tilt (spec 020): draw everything rotated about a center point (in top-left
// coords). deg is the on-screen clockwise angle; pdf rotates counterclockwise, hence -deg.
interface RotSpec {
  deg: number;
  cx: number;
  cy: number;
}

// The pdf bottom-left anchor + rotate for a top-left box, rotated about `rot`'s center.
function placeRotated(x: number, y: number, h: number, mediaH: number, rot?: RotSpec) {
  const px = x;
  const py = mediaH - y - h;
  if (!rot || !rot.deg) return { x: px, y: py, rotate: degrees(0) };
  const cx = rot.cx;
  const cy = mediaH - rot.cy;
  const a = (-rot.deg * Math.PI) / 180;
  const dx = px - cx;
  const dy = py - cy;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos, rotate: degrees(-rot.deg) };
}

// Same for a point anchor (a text baseline-left), rotated about `rot`'s center.
function pointRotated(x: number, y: number, mediaH: number, rot?: RotSpec) {
  const px = x;
  const py = mediaH - y;
  if (!rot || !rot.deg) return { x: px, y: py, rotate: degrees(0) };
  const cx = rot.cx;
  const cy = mediaH - rot.cy;
  const a = (-rot.deg * Math.PI) / 180;
  const dx = px - cx;
  const dy = py - cy;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos, rotate: degrees(-rot.deg) };
}

// Draw a decorative frame (spec 019): fill the mat, draw the contained photo inset inside
// it (never clipped), and draw the handwritten note in the bottom band. The whole unit tilts
// as one when rotated (spec 020). Falls back to a plain photo if the frame id is unknown.
async function drawFramedPhoto(
  ctx: Ctx,
  box: PhotoBox,
  url: string,
  item: {
    photoRatio: number;
    sourceRatio: number;
    frame?: string;
    frameColor?: string;
    frameText?: string;
    frameWidth?: number;
    frameFocus?: CropFocus;
    crop?: CropRect;
    mask?: string;
    rotation?: number;
  },
) {
  // The whole unit tilts about the outer box center (spec 020).
  const rot: RotSpec | undefined = item.rotation ? { deg: item.rotation, cx: box.x + box.w / 2, cy: box.y + box.h / 2 } : undefined;
  const style = frameById(item.frame);
  if (!style) return drawPhoto(ctx, box, url, item.crop, item.mask, rot);
  const color = frameColorOf(item.frameColor, style.defaultColor);
  // Fill the mat rectangle (flip y to pdf's bottom-left origin). No rounded corners.
  const mat = hexToRgb(color.value);
  const mr = placeRotated(box.x, box.y, box.h, ctx.mediaH, rot);
  ctx.page.drawRectangle({ x: mr.x, y: mr.y, width: box.w, height: box.h, color: rgb(mat[0], mat[1], mat[2]), rotate: mr.rotate });
  const inner = frameInner(style, box.w, box.h, borderWidthOf(item.frameWidth));
  if (style.square) {
    // Polaroid: fill the square window with a pixel-square region of the source at the focus.
    const sq = squareCrop(item.sourceRatio, item.frameFocus ?? DEFAULT_CROP_FOCUS);
    await drawPhoto(ctx, { photoId: box.photoId, x: box.x + inner.x, y: box.y + inner.y, w: inner.w, h: inner.h }, url, sq, item.mask, rot);
  } else {
    // Border: contain the photo (its effective ratio) inside the inner area, centered.
    const r = item.photoRatio;
    const pw = inner.w / inner.h > r ? inner.h * r : inner.w;
    const ph = inner.w / inner.h > r ? inner.h : inner.w / r;
    await drawPhoto(ctx, { photoId: box.photoId, x: box.x + inner.x + (inner.w - pw) / 2, y: box.y + inner.y + (inner.h - ph) / 2, w: pw, h: ph }, url, item.crop, item.mask, rot);
  }
  // Handwritten note in the bottom band.
  const note = supportedText((item.frameText ?? "").trim(), ctx.hand?.has ?? (() => false));
  if (style.hasText && note && ctx.hand) {
    const bandTop = box.y + inner.y + inner.h;
    const bandH = box.h - (inner.y + inner.h);
    const size = Math.min(bandH * 0.5, box.w * 0.08);
    const ink = hexToRgb(color.ink);
    let width: number;
    try {
      width = ctx.hand.pdf.widthOfTextAtSize(note, size);
    } catch {
      return;
    }
    const np = pointRotated(box.x + box.w / 2 - width / 2, bandTop + bandH / 2 + size * 0.35, ctx.mediaH, rot);
    try {
      ctx.page.drawText(note, {
        x: np.x,
        y: np.y,
        size,
        font: ctx.hand.pdf,
        color: rgb(ink[0], ink[1], ink[2]),
        rotate: np.rotate,
      });
    } catch {
      /* a glyph the font lacks: skip the note rather than fail the export */
    }
  }
}

// Draw text centered on cx with its top at y (top-left space), flipping to pdf's
// bottom-left origin. Silently skips text that cannot be encoded.
function drawCenteredText(ctx: Ctx, place: TextPlace, color: [number, number, number]) {
  // The album font is an embedded TrueType face since spec 040, so the repertoire is the
  // face's own rather than CP1252: far wider, but not unlimited, and an unmapped code point
  // would paint a .notdef box. Drop those, the way the WinAnsi filter used to (issue 75).
  const text = supportedText(place.text, ctx.font.has);
  if (!text) return;
  let width: number;
  try {
    width = ctx.font.pdf.widthOfTextAtSize(text, place.sizePt);
  } catch {
    return;
  }
  const baselineTop = place.y + place.sizePt * 0.8;
  // A caption on a tilted photo rotates about the photo center (spec 020, #5); titles have no rot.
  const rot = place.rot ? { deg: place.rot.deg, cx: place.rot.cx0, cy: place.rot.cy0 } : undefined;
  const anchor = pointRotated(place.cx - width / 2, baselineTop, ctx.mediaH, rot);
  try {
    ctx.page.drawText(text, {
      x: anchor.x,
      y: anchor.y,
      size: place.sizePt,
      font: ctx.font.pdf,
      color: rgb(color[0], color[1], color[2]),
      rotate: anchor.rotate,
    });
  } catch {
    /* unsupported glyph run: skip rather than fail the whole export */
  }
}

async function drawPhoto(ctx: Ctx, box: PhotoBox, url: string, crop?: CropRect, mask?: string, rot?: RotSpec) {
  const res = await photoJpegBytes(url, box.w, box.h, box.cover ? { focus: box.focus ?? DEFAULT_CROP_FOCUS } : undefined, crop, mask);
  if (!res) return; // missing/undecodable: leave the whitespace
  const img = res.png ? await ctx.page.doc.embedPng(res.bytes) : await ctx.page.doc.embedJpg(res.bytes);
  const p = placeRotated(box.x, box.y, box.h, ctx.mediaH, rot);
  ctx.page.drawImage(img, { x: p.x, y: p.y, width: box.w, height: box.h, rotate: p.rotate });
}


// ---------------------------------------------------------------------------
// Notes (spec 039)
// ---------------------------------------------------------------------------

/**
 * The export could not be built. Thrown rather than returning a page-less document: such a
 * file downloads and opens as a valid, empty PDF, which reads as "it worked" (`BundleError`
 * in src/lib/bundle.ts is the same contract for the project bundle).
 */
export class ExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExportError";
  }
}

/** A key identifying one shipped face inside a document's embedded-font cache. */
const faceKey = (font: ShippedFontId, bold: boolean, italic: boolean) =>
  `${font}:${shippedFontFace(font, { bold, italic }).assetUrl}`;

/**
 * Embed one shipped face into a document, once, and cache it. The bytes come from the very
 * file the browser rendered with, which is what makes the printed text identical to the
 * previewed text, line breaks included (see src/lib/fonts.ts). This replaced the three
 * standard PDF families the album text used to be substituted with (issue #99), and it is
 * the same path a note face takes (spec 039), so a note and the album share one embedding
 * when they are set in the same family.
 */
async function embedFace(
  doc: PDFDocument,
  cache: Map<string, Face>,
  font: ShippedFontId,
  opts: { bold?: boolean; italic?: boolean } = {},
): Promise<Face | undefined> {
  const key = faceKey(font, opts.bold === true, opts.italic === true);
  const hit = cache.get(key);
  if (hit) return hit;
  try {
    const buffer = await fetch(shippedFontFace(font, opts).assetUrl).then((r) => r.arrayBuffer());
    const bytes = new Uint8Array(buffer);
    const pdf = await doc.embedFont(bytes, { subset: true });
    // Read the same bytes with fontkit for the coverage predicate: pdf-lib exposes no way
    // to ask an embedded font whether it has a glyph for a code point.
    const metrics = fontkit.create(bytes as unknown as Uint8Array<ArrayBuffer>);
    const face: Face = { pdf, has: (cp) => metrics.hasGlyphForCodePoint(cp) };
    cache.set(key, face);
    return face;
  } catch {
    return undefined; // a face that cannot be read leaves its text unpainted
  }
}

/** Embed every face a set of notes needs, into the document's shared cache. */
async function embedNoteFaces(
  doc: PDFDocument,
  cache: Map<string, Face>,
  places: NotePlace[],
): Promise<Map<string, Face>> {
  for (const place of places) {
    await embedFace(doc, cache, place.font, { bold: place.bold, italic: place.italic });
  }
  return cache;
}

/** The album colors a note's ink resolves against, as hex, for the pure `noteInk`. */
function notePalette(colorTheme: ColorThemeId): NotePalette {
  const c = colorThemeOrDefault(colorTheme);
  return { ink: c.ink, inkSoft: c.inkSoft, accent: c.accent.light, paper: c.paper };
}

/**
 * Paint one note. The lines are wrapped at the canonical reference size with the embedded
 * font's own metrics, then drawn at the page size, so the break points are the ones the
 * editor showed. Tracking is applied character by character because pdf-lib has no letter
 * spacing, mirroring what CSS does (a trailing space after the last character included).
 */
function drawNote(ctx: Ctx, place: NotePlace, face: Face, palette: NotePalette) {
  const font = face.pdf;
  const refMeasure = (t: string) => {
    try {
      return font.widthOfTextAtSize(t, place.refSize);
    } catch {
      return t.length * place.refSize * 0.5;
    }
  };
  // Filter before wrapping, so a character the face cannot draw changes neither the line
  // breaks nor the centring (it would otherwise be a full-width .notdef box).
  const text = supportedText(place.text, face.has);
  const lines = wrapLines(text, place.wrapW, (t) => measureTracked(t, refMeasure, place.refTrackingPt));
  if (lines.length === 0) return;

  const measure = (t: string) => {
    try {
      return font.widthOfTextAtSize(t, place.sizePt);
    } catch {
      return t.length * place.sizePt * 0.5;
    }
  };

  const textH = lines.length * place.lineHeightPt;
  const ruleH = place.rule ? place.ruleGapPt + place.ruleWeightPt : 0;
  const boxH = textH + 2 * place.padYPt + ruleH;
  const left = place.cx - place.w / 2;
  const top = place.cy - boxH / 2;
  const rot = place.rotation ? { deg: place.rotation, cx: place.cx, cy: place.cy } : undefined;
  const [r, g, b] = hexToRgb(noteInk(place.ink, place.customInk, palette));
  const color = rgb(r, g, b);

  // The paper reserve first, so the text sits on it (spec 039).
  if (place.cartouche) {
    const [pr, pg, pb] = hexToRgb(palette.paper);
    const p = placeRotated(left, top, boxH, ctx.mediaH, rot);
    ctx.page.drawRectangle({
      x: p.x,
      y: p.y,
      width: place.w,
      height: boxH,
      color: rgb(pr, pg, pb),
      opacity: place.opacity,
      rotate: p.rotate,
    });
  }

  const textTop = top + place.padYPt + (place.rule === "over" ? ruleH : 0);
  const innerLeft = left + place.padXPt;
  const innerW = place.w - 2 * place.padXPt;

  if (place.rule) {
    const ruleY = place.rule === "over" ? top + place.padYPt : top + boxH - place.padYPt - place.ruleWeightPt;
    const p = placeRotated(left, ruleY, place.ruleWeightPt, ctx.mediaH, rot);
    ctx.page.drawRectangle({
      x: p.x,
      y: p.y,
      width: place.w,
      height: place.ruleWeightPt,
      color,
      opacity: place.opacity,
      rotate: p.rotate,
    });
  }

  lines.forEach((line, i) => {
    if (!line) return;
    const lineW = measureTracked(line, measure, place.trackingPt);
    const x =
      place.align === "left"
        ? innerLeft
        : place.align === "right"
          ? innerLeft + innerW - lineW
          : innerLeft + (innerW - lineW) / 2;
    // Mirror the browser's half-leading so the baselines land where the editor drew them.
    const glyphTop = textTop + i * place.lineHeightPt + (place.lineHeightPt - place.sizePt) / 2;
    const baseline = glyphTop + place.sizePt * 0.8;
    const opts = { size: place.sizePt, font, color, opacity: place.opacity };
    if (place.trackingPt > 0) {
      // Character by character, because pdf-lib cannot letter-space a run.
      let cursor = x;
      for (const ch of line) {
        const a = pointRotated(cursor, baseline, ctx.mediaH, rot);
        try {
          ctx.page.drawText(ch, { ...opts, x: a.x, y: a.y, rotate: a.rotate });
        } catch {
          /* skip an unsupported glyph rather than fail the export */
        }
        cursor += measure(ch) + place.trackingPt;
      }
      return;
    }
    const a = pointRotated(x, baseline, ctx.mediaH, rot);
    try {
      ctx.page.drawText(line, { ...opts, x: a.x, y: a.y, rotate: a.rotate });
    } catch {
      /* skip an unsupported glyph run rather than fail the whole export */
    }
  });
}

/** Paint every note of a page or a cover face, over whatever is already drawn. */
function drawNotes(ctx: Ctx, places: NotePlace[], faces: Map<string, Face>, palette: NotePalette) {
  for (const place of places) {
    const face = faces.get(faceKey(place.font, place.bold, place.italic));
    if (face) drawNote(ctx, place, face, palette);
  }
}

function fillPaper(ctx: Ctx, rect: PtRect) {
  ctx.page.drawRectangle({
    x: rect.x,
    y: ctx.mediaH - rect.y - rect.h,
    width: rect.w,
    height: rect.h,
    color: rgb(ctx.palette.paper[0], ctx.palette.paper[1], ctx.palette.paper[2]),
  });
}

async function paintInteriorPage(doc: PDFDocument, font: Face, hand: Face | undefined, palette: Palette, p: ExportProject, pageLike: ExportPageLike, noteFaces: Map<string, Face>, bindingSide: BindingSide) {
  const first = pageLike.items[0];
  const g: PageGeometry = pageLike.insideCover
    ? insideCoverPageGeometry({
        size: p.size,
        bindingSide,
        title: pageLike.title,
        subtitle: pageLike.subtitle,
        whitespace: pageLike.whitespace,
        photo: first ? { photoId: first.photoId, ratio: first.ratio } : undefined,
        scales: {
          coverTitle: sizeScale(p.textSizes.coverTitle),
          coverSubtitle: sizeScale(p.textSizes.coverSubtitle),
        },
        notes: pageLike.notes,
      })
    : interiorPageGeometry({
        size: p.size,
        bindingSide,
        items: pageLike.items.map((i) => ({ photoId: i.photoId, ratio: i.ratio, caption: i.caption, rotation: i.rotation })),
        layoutId: pageLike.layoutId,
        whitespace: pageLike.whitespace,
        title: pageLike.title,
        subtitle: pageLike.subtitle,
        scales: {
          pageTitle: sizeScale(p.textSizes.pageTitle),
          pageSubtitle: sizeScale(p.textSizes.pageSubtitle),
          caption: sizeScale(p.textSizes.caption),
        },
        fullPage: pageLike.fullPage,
        focus: pageLike.focus,
        placement: pageLike.placement,
        notes: pageLike.notes,
      });
  const page = doc.addPage([g.mediaBox.w, g.mediaBox.h]);
  page.setTrimBox(g.trimBox.x, g.mediaBox.h - g.trimBox.y - g.trimBox.h, g.trimBox.w, g.trimBox.h);
  page.setBleedBox(0, 0, g.mediaBox.w, g.mediaBox.h);
  const ctx: Ctx = { page, mediaH: g.mediaBox.h, font, palette, hand };

  fillPaper(ctx, g.mediaBox); // paper bleeds to the edge
  const urlOf = new Map(pageLike.items.map((i) => [i.photoId, i.url]));
  const itemOf = new Map(pageLike.items.map((i) => [i.photoId, i]));
  for (const box of g.photos) {
    const url = urlOf.get(box.photoId);
    if (!url) continue;
    const item = itemOf.get(box.photoId);
    if (item?.frame) {
      // Decorative frame (spec 019): mat + inset photo + note, drawn inside the box.
      await drawFramedPhoto(ctx, box, url, item);
    } else {
      const rot = item?.rotation ? { deg: item.rotation, cx: box.x + box.w / 2, cy: box.y + box.h / 2 } : undefined;
      await drawPhoto(ctx, box, url, item?.crop, item?.mask, rot);
    }
  }
  if (g.title) drawCenteredText(ctx, g.title, palette.ink);
  if (g.subtitle) drawCenteredText(ctx, g.subtitle, palette.inkSoft);
  for (const cap of g.captions) drawCenteredText(ctx, cap, palette.inkSoft);
  // Notes last: they are an overlay, painted over the photos and the page text (spec 039).
  drawNotes(ctx, g.notes, noteFaces, notePalette(p.colorTheme));
}

// The text-size levels are multipliers; mirror src/lib/text-sizes.ts SIZE_SCALE.
function sizeScale(level: "sm" | "md" | "lg" | "xl"): number {
  return level === "sm" ? 0.85 : level === "lg" ? 1.2 : level === "xl" ? 1.45 : 1;
}

/** A page with nothing on it: the leaf that pads an odd interior to an even count. */
export function blankLeaf(): ExportPageLike {
  return { title: "", subtitle: "", whitespace: 4, layoutId: "single", items: [] };
}

/**
 * Blurb's page count must be a multiple of 2. Pad with one blank leaf placed just before the
 * inside back cover, so the added sheet lands at the end of the book rather than in the middle
 * of a sequence the author arranged.
 */
export function evenInterior(interior: ExportPageLike[]): ExportPageLike[] {
  if (interior.length % 2 === 0) return interior;
  return [...interior.slice(0, -1), blankLeaf(), ...interior.slice(-1)];
}

/** Build the interior PDF: inside front, every content page, inside back. */
export async function buildInteriorPdf(p: ExportProject): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  // Every face is a shipped file, embedded on demand and shared across the document: the
  // album's own style (spec 040), the handwriting of a Polaroid note (spec 019) and whatever
  // families the page notes use (spec 039). Nothing is substituted any more.
  const faces = new Map<string, Face>();
  const font = await embedFace(doc, faces, albumFontFamily(p.fontTheme));
  // Without the album face there is no text to draw with, and a PDF with no page at all is
  // worse than no file: it downloads, it opens as a valid PDF and it is empty. Fail instead.
  if (!font) throw new ExportError(`album font "${albumFontFamily(p.fontTheme)}" could not be read`);
  // The handwriting face is only needed by a Polaroid frame note (spec 019). If its file
  // cannot be read, that one note goes unpainted; the rest of the book still prints.
  const hand = await embedFace(doc, faces, "caveat");
  const palette = paletteOf(p.colorTheme);
  const noteFaces = await embedNoteFaces(
    doc,
    faces,
    p.interior.flatMap((pl) =>
      notePlaces(pl.notes, { x: 0, y: 0, w: mmToPt(p.size.widthMm), h: mmToPt(p.size.heightMm) }),
    ),
  );
  // Blurb refuses an odd page count ("submit an even number of pages"), and pads the file
  // itself if you insist, which shifts every spread after the padding. Add the blank leaf
  // ourselves, before the inside back cover, so the book ends where the author meant it to.
  const leaves = evenInterior(p.interior);
  // The first leaf of the interior file is a right-hand page, so it binds on its LEFT and
  // carries its bleed on the right; the side alternates from there (spec 041).
  for (const [i, pageLike] of leaves.entries()) {
    await paintInteriorPage(doc, font, hand, palette, p, pageLike, noteFaces, i % 2 === 0 ? "left" : "right");
  }
  return doc.save();
}

/** Build the cover-wrap PDF: back (left) + spine + front (right), with bleed. */
export async function buildCoverWrapPdf(p: ExportProject, spineWidthPt: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const faces = new Map<string, Face>();
  const font = await embedFace(doc, faces, albumFontFamily(p.fontTheme));
  if (!font) throw new ExportError(`album font "${albumFontFamily(p.fontTheme)}" could not be read`);
  const palette = paletteOf(p.colorTheme);

  const toFace = (f: ExportCoverFace): CoverFaceInput => ({
    title: f.title,
    subtitle: f.subtitle,
    whitespace: f.whitespace,
    photo: f.photo ? { photoId: f.photo.photoId, ratio: f.photo.ratio } : null,
    notes: f.notes,
  });

  const g = coverWrapGeometry({
    size: p.size,
    spineWidthPt,
    front: toFace(p.front),
    back: toFace(p.back),
    spineTitle: p.spineTitle,
    spineSubtitle: p.spineSubtitle,
    scales: { coverTitle: sizeScale(p.textSizes.coverTitle), coverSubtitle: sizeScale(p.textSizes.coverSubtitle) },
  });

  const page = doc.addPage([g.mediaBox.w, g.mediaBox.h]);
  page.setBleedBox(0, 0, g.mediaBox.w, g.mediaBox.h);
  const ctx: Ctx = { page, mediaH: g.mediaBox.h, font, palette };
  fillPaper(ctx, g.mediaBox);

  const noteFaces = await embedNoteFaces(doc, faces, [...g.back.notes, ...g.front.notes]);
  const inks = notePalette(p.colorTheme);

  for (const [panel, face] of [
    [g.back, p.back.photo],
    [g.front, p.front.photo],
  ] as const) {
    if (panel.photo && face?.url) await drawPhoto(ctx, panel.photo, face.url, face.crop);
    if (panel.title) drawCenteredText(ctx, panel.title, palette.ink);
    if (panel.subtitle) drawCenteredText(ctx, panel.subtitle, palette.inkSoft);
    drawNotes(ctx, panel.notes, noteFaces, inks);
  }

  // Spine text: each line rotated 90 deg so it runs along the spine, centered.
  for (const line of g.spineLines) {
    const text = supportedText(line.text, font.has);
    if (!text) continue;
    let width: number;
    try {
      width = font.pdf.widthOfTextAtSize(text, line.sizePt);
    } catch {
      width = 0;
    }
    if (width <= 0) continue;
    try {
      page.drawText(text, {
        x: line.cx + line.sizePt * 0.35,
        y: g.mediaBox.h - line.y - width / 2,
        size: line.sizePt,
        font: font.pdf,
        color: rgb(palette.ink[0], palette.ink[1], palette.ink[2]),
        rotate: degrees(90),
      });
    } catch {
      /* skip a line that cannot be encoded */
    }
  }

  return doc.save();
}
