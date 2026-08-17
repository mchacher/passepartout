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
  photoIds: string[];
  whitespace: number; // per-page whitespace level, 1 (least white) .. WHITESPACE_LEVELS (most)
  layoutId: string; // which arrangement template (see src/lib/layouts.ts) is applied
}

// Whitespace is chosen in discrete levels: 1 = least white (photos fill their
// region), WHITESPACE_LEVELS = most white. The engine works in a continuous
// density (see whitespaceToDensity in src/lib/layout.ts).
export const WHITESPACE_LEVELS = 8;

// Whitespace level a fresh page starts with.
export const DEFAULT_WHITESPACE = 4;

// The layout a page falls back to before any photos land on it (a single slot).
export const DEFAULT_LAYOUT_ID = "single";

export type PageFormat = "square" | "landscape" | "portrait";

// Aspect ratio = width / height of a single page.
export const PAGE_ASPECT: Record<PageFormat, number> = {
  square: 1,
  landscape: 1.414, // A-series landscape
  portrait: 0.707, // A-series portrait
};
