// Core domain types. A Photo keeps its native aspect ratio forever: the layout
// engine only ever chooses its size and the whitespace around it, never a crop.

import type { ShippedFontId } from "./lib/fonts";

// A normalized sub-rectangle of a photo's source (spec 015): the region the user chose to
// keep, in 0..1 fractions of the source. Absent = the whole image (no crop, the default).
export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Photo {
  id: string;
  url: string; // object URL or data URL, lives only in this browser session
  w: number; // natural pixel width
  h: number; // natural pixel height
  ratio: number; // w / h of the source; the KEPT region's ratio is the effective ratio
  time: number; // capture time (EXIF DateTimeOriginal, else file mtime), ms epoch
  name: string;
  caption: string;
  // Placement is NOT stored on the photo (spec 017): a photo can appear on any number of
  // pages and cover faces at once. Where it is used is derived from the pages' photoIds and
  // the cover photoIds (see src/lib/usage.ts). The Library is a permanent catalog.
  // Opt-in crop (spec 015): the kept sub-rectangle of the source, normalized. Absent = the
  // whole image. The kept region is shown contain-fit (undistorted); its ratio is the
  // photo's effective ratio (see src/lib/crop.ts). No-crop stays the default.
  crop?: CropRect;
  // Opt-in decorative mask (spec 018): the id of a shape from the mask catalog
  // (src/lib/masks.ts), or absent for the default rectangle. The mask scales to the photo's
  // box and only hides the pixels outside the shape; it never changes the ratio or size.
  mask?: string;
  // For the rounded mask (spec 034): the corner radius as a fraction of the box's shorter side,
  // one of ROUNDED_SIZES. A constant, circular radius (does not follow the photo's aspect).
  // Absent = the default size; ignored by every other mask.
  maskRadius?: number;
  // Opt-in decorative frame (spec 019): a mat around the photo, from src/lib/frames.ts.
  // `frame` is a style id, `frameColor` a color id. Border keeps the photo whole and takes a
  // `frameWidth` (fraction of the box width). Polaroid squares the photo (cover-crop) with a
  // `frameFocus` you can pan (Shift-drag) and holds an optional handwritten `frameText`.
  // All absent = no frame, the default.
  frame?: string;
  frameColor?: string;
  frameText?: string;
  frameWidth?: number;
  frameFocus?: CropFocus;
  // Opt-in decorative tilt in degrees (spec 020), a multiple of the step within a small
  // range; absent = 0 (level). A whole-photo rotation: it never crops or changes the ratio,
  // it composes with the crop / mask / frame (the whole unit tilts).
  rotation?: number;
}

// Full-page mode for a single-photo page (spec 012). `contain` (Fit) maximizes the photo
// to the page edges without ever cropping (paper bands where the ratio differs). `cover`
// (Fill) crops the photo to the page ratio to cover all four edges. `contain` keeps the
// founding no-crop rule; `cover` is the one explicit, opt-in clip.
export type PageFill = "contain" | "cover";

// Normalized crop focus for a `cover` full-page photo: which part of the photo stays
// visible. Each axis is 0..1 (0 = left/top edge kept, 1 = right/bottom, 0.5 = centered).
// Only the overflowing axis has any effect. The ratio is never changed; only the overflow
// is clipped.
export interface CropFocus {
  x: number;
  y: number;
}

// A photo's rectangle on the page grid (spec 013), in half-open cell ranges over the
// fixed GRID_COLS x GRID_ROWS grid. Templates are lists of these; a custom placement is
// the same shape. The photo is always contain-fit inside the rectangle, never cropped.
export interface CellRect {
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  // Stacking order for overlapping custom placements (spec 013 Phase B): higher draws in
  // front. Templates omit it (no overlap); the layout engine ignores it (geometry only);
  // renderers and the print painter use it to layer overlapping cells (see drawOrder).
  z?: number;
  // Where the contain-fit photo sits inside its cell's free space (spec 013 Phase B):
  // ax/ay in 0..1 (0 = left/top edge, 0.5 = centered, 1 = right/bottom). Only the axis
  // that has whitespace moves; the photo is never cropped, just repositioned. Default 0.5.
  ax?: number;
  ay?: number;
}

export interface AlbumPage {
  id: string;
  title: string;
  subtitle: string; // optional line under the title, contained in whitespace (never on a photo)
  // The photos placed on the page, in slot order (spec 035). A page has a SLOT COUNT (its
  // layout capacity, see slotCount in src/lib/layouts.ts) that is independent of how many
  // photos are placed: photoIds fills the first slots and the rest render as empty drop
  // targets. Photos only enter a page by dragging, never automatically. Invariant:
  // photoIds.length <= slotCount(page).
  photoIds: string[];
  whitespace: number; // per-page whitespace level, 1 (least white) .. WHITESPACE_LEVELS (most)
  layoutId: string; // arrangement template (src/lib/layouts.ts); its leaf count IS the slot count
  // Custom grid placement (spec 013). When present and its length matches the photo count,
  // it overrides the named template (the page is "detached"). Written by the free-placement
  // editor (Phase B); cleared when a template is re-selected or the count changes.
  placement?: CellRect[];
  // Full-page photo mode (spec 012). Undefined = a normal page. Effective only when the
  // page holds exactly one photo; cleared when the count leaves 1.
  fullPage?: PageFill;
  // Crop focus for `cover` full-page mode; defaults to centered when absent.
  fullPageFocus?: CropFocus;
  // Freely placed text notes (spec 039), painted over the laid-out photos. Absent or
  // empty = no note; they never take part in the layout.
  notes?: Note[];
}

// Where a cover face draws its title and subtitle (spec 042): in the band above the photo,
// which is the default and what every album made before the choice existed uses, or in the
// same band mirrored under it. It moves the text and the photo's area, never the photo's
// framing.
export type CoverTextPosition = "top" | "bottom";

// A booklet cover face: text plus one optional photo chosen from the library. The
// photo is contained (never cropped), like everything else. A book cover is a folded
// sheet with four faces (outside + inside, front and back); each is a Cover.
export interface Cover {
  title: string;
  subtitle: string;
  photoId: string | null; // references a library Photo, or null for a text-only cover
  whitespace: number; // whitespace level 1 .. WHITESPACE_LEVELS for the cover photo
  // Which side of the photo the title and subtitle sit on (spec 042). Absent = "top", the
  // original layout; every project saved before the choice existed reads as "top".
  textPosition?: CoverTextPosition;
  // Freely placed text notes (spec 039), exactly as on an interior page.
  notes?: Note[];
}

// The book spine (the edge of the bound book). Its title normally repeats the front
// cover title; an empty title means "use the front cover title" (see
// effectiveSpineTitle in src/lib/project.ts).
export interface Spine {
  title: string;
}

// The four cover faces, in booklet order:
//   front         = outside of the front cover
//   insideFront   = inside of the front cover (faces the first page)
//   insideBack    = inside of the back cover (faces the last page)
//   back          = outside of the back cover
export type CoverFace = "front" | "insideFront" | "insideBack" | "back";

// Whitespace is chosen in discrete levels: 1 = least white (photos fill their
// region), WHITESPACE_LEVELS = most white. The engine works in a continuous
// density (see whitespaceToDensity in src/lib/layout.ts).
export const WHITESPACE_LEVELS = 8;

// Whitespace level a fresh page (and cover) starts with. 1 is the tightest, so photos
// are maximized to their contain-fit by default (spec 010); the slider adds whitespace.
export const DEFAULT_WHITESPACE = 1;

// The layout a page falls back to before any photos land on it (a single slot).
export const DEFAULT_LAYOUT_ID = "single";

// The crop focus a `cover` full-page photo starts with: centered (a symmetric crop).
export const DEFAULT_CROP_FOCUS: CropFocus = { x: 0.5, y: 0.5 };

// Name a fresh project is created with (see src/lib/project.ts).
export const DEFAULT_PROJECT_NAME = "Untitled";

// Legacy page format (spec 001-007). Superseded by the physical book size
// (src/lib/book-sizes.ts); kept only so migration can read an old project doc's
// `format` and map it to a Blurb size. Not used for rendering anymore.
export type PageFormat = "square" | "landscape" | "portrait";

// Aspect ratio = width / height of a single page (legacy, see PageFormat).
export const PAGE_ASPECT: Record<PageFormat, number> = {
  square: 1,
  landscape: 1.414, // A-series landscape
  portrait: 0.707, // A-series portrait
};

// ---------------------------------------------------------------------------
// Notes (spec 039)
// ---------------------------------------------------------------------------

/** How a note's lines sit inside its box. */
export type NoteAlign = "left" | "center" | "right";

/** The ink a note is written in. Everything but `custom` follows the album palette. */
export type NoteInkId = "ink" | "inkSoft" | "accent" | "paper" | "custom";

/** One of the five note sizes, a fraction of the page width (see src/lib/notes.ts). */
export type NoteSizeLevel = "xs" | "sm" | "md" | "lg" | "xl";

/**
 * A small block of text placed freely on a page or a cover face (spec 039). It belongs to
 * the page, never to a photo: it is an OVERLAY, painted after the engine has laid the photos
 * out. Nothing about a note enters `computeLayout`, so no photo is ever moved, resized or
 * clipped because a note exists.
 *
 * Placement is normalized to the page, `x`/`y` being the box's CENTRE, so the same numbers
 * drive the editor, the thumbnails, the book preview and the PDF at any zoom.
 */
export interface Note {
  id: string;
  /** The text, which may hold explicit line breaks. */
  text: string;
  x: number; // 0..1 of the page width, the box centre
  y: number; // 0..1 of the page height, the box centre
  w: number; // 0..1 of the page width: the width the text wraps at
  /** Decorative tilt in degrees, the same range and steps as a photo (spec 020). */
  rotation?: number;
  font: ShippedFontId;
  size: NoteSizeLevel;
  bold?: boolean;
  italic?: boolean;
  align: NoteAlign;
  ink: NoteInkId;
  /** A hex color, only meaningful when `ink` is `custom`. */
  customInk?: string;
  /** Uppercase with tracking, the small-caps caption treatment. */
  caps?: boolean;
  /** A hairline rule above or below the text; absent = none. */
  rule?: "over" | "under";
  /** 0.6 or 0.3; absent = fully opaque. */
  opacity?: number;
  /** A paper reserve behind the text, so a note stays legible over a photo. */
  cartouche?: boolean;
}

/** Where a note lives. Never serialized: it only addresses a store action or a selection. */
export type NoteTarget =
  | { kind: "page"; pageId: string }
  | { kind: "cover"; face: CoverFace };
