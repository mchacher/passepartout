// Core domain types. A Photo keeps its native aspect ratio forever: the layout
// engine only ever chooses its size and the whitespace around it, never a crop.

export interface Photo {
  id: string;
  url: string; // object URL or data URL, lives only in this browser session
  w: number; // natural pixel width
  h: number; // natural pixel height
  ratio: number; // w / h, the sacred value we never violate
  time: number; // capture time (EXIF DateTimeOriginal, else file mtime), ms epoch
  name: string;
  caption: string;
  pageId: string | null; // null = still in the library, not placed
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
  photoIds: string[];
  whitespace: number; // per-page whitespace level, 1 (least white) .. WHITESPACE_LEVELS (most)
  layoutId: string; // which arrangement template (see src/lib/layouts.ts) is applied
  // Custom grid placement (spec 013). When present and its length matches the photo count,
  // it overrides the named template (the page is "detached"). Written by the free-placement
  // editor (Phase B); cleared when a template is re-selected or the count changes.
  placement?: CellRect[];
  // Full-page photo mode (spec 012). Undefined = a normal page. Effective only when the
  // page holds exactly one photo; cleared when the count leaves 1.
  fullPage?: PageFill;
  // Crop focus for `cover` full-page mode; defaults to centered when absent.
  fullPageFocus?: CropFocus;
}

// A booklet cover face: text plus one optional photo chosen from the library. The
// photo is contained (never cropped), like everything else. A book cover is a folded
// sheet with four faces (outside + inside, front and back); each is a Cover.
export interface Cover {
  title: string;
  subtitle: string;
  photoId: string | null; // references a library Photo, or null for a text-only cover
  whitespace: number; // whitespace level 1 .. WHITESPACE_LEVELS for the cover photo
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
