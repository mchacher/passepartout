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

export interface AlbumPage {
  id: string;
  title: string;
  subtitle: string; // optional line under the title, contained in whitespace (never on a photo)
  photoIds: string[];
  whitespace: number; // per-page whitespace level, 1 (least white) .. WHITESPACE_LEVELS (most)
  layoutId: string; // which arrangement template (see src/lib/layouts.ts) is applied
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

// Whitespace level a fresh page starts with.
export const DEFAULT_WHITESPACE = 4;

// The layout a page falls back to before any photos land on it (a single slot).
export const DEFAULT_LAYOUT_ID = "single";

// Name a fresh project is created with (see src/lib/project.ts).
export const DEFAULT_PROJECT_NAME = "Untitled";

export type PageFormat = "square" | "landscape" | "portrait";

// Aspect ratio = width / height of a single page.
export const PAGE_ASPECT: Record<PageFormat, number> = {
  square: 1,
  landscape: 1.414, // A-series landscape
  portrait: 0.707, // A-series portrait
};
