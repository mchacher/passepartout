import { create } from "zustand";
import {
  DEFAULT_WHITESPACE,
  DEFAULT_LAYOUT_ID,
  type AlbumPage,
  type PageFormat,
  type Photo,
} from "./types";
import { readCaptureTime } from "./lib/exif";
import { makeDemoPhotos } from "./lib/demo";
import { defaultLayoutId, getLayout } from "./lib/layouts";

const DEFAULT_PER_PAGE = 3;

function newPage(): AlbumPage {
  return {
    id: crypto.randomUUID(),
    title: "",
    photoIds: [],
    whitespace: DEFAULT_WHITESPACE,
    layoutId: DEFAULT_LAYOUT_ID,
  };
}

// Keep a page's layout consistent with its photo count. The chosen template stays
// when it still fits the count; otherwise it resets to that count's default.
function syncLayout(page: AlbumPage): void {
  const count = page.photoIds.length;
  const tpl = getLayout(page.layoutId);
  if (!tpl || tpl.count !== count) {
    page.layoutId = defaultLayoutId(count);
  }
}

interface AlbumState {
  photos: Photo[];
  pages: AlbumPage[];
  format: PageFormat;

  importFiles: (files: FileList | File[]) => Promise<void>;
  loadDemo: () => void;
  autoDistribute: () => void;

  placeOnPage: (photoId: string, pageId: string) => void;
  removeFromPage: (photoId: string) => void;
  setPageCount: (pageId: string, n: number) => void;

  addPage: () => void;
  deletePage: (pageId: string) => void;
  setPageTitle: (pageId: string, title: string) => void;
  setPageWhitespace: (pageId: string, whitespace: number) => void;
  setPageLayout: (pageId: string, layoutId: string) => void;
  setCaption: (photoId: string, caption: string) => void;

  setFormat: (format: PageFormat) => void;
  reset: () => void;
}

function distribute(photos: Photo[]): AlbumPage[] {
  const pages: AlbumPage[] = [];
  let cur: AlbumPage | null = null;
  photos.forEach((p, i) => {
    if (i % DEFAULT_PER_PAGE === 0) {
      cur = newPage();
      pages.push(cur);
    }
    cur!.photoIds.push(p.id);
    p.pageId = cur!.id;
  });
  if (pages.length === 0) {
    pages.push(newPage());
  }
  pages.forEach(syncLayout);
  return pages;
}

async function loadPhoto(file: File): Promise<Photo | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      let time = file.lastModified;
      try {
        const buf = await file.arrayBuffer();
        const captured = readCaptureTime(buf);
        if (captured) time = captured;
      } catch {
        /* keep lastModified */
      }
      resolve({
        id: crypto.randomUUID(),
        url,
        w: img.naturalWidth,
        h: img.naturalHeight,
        ratio: img.naturalWidth / img.naturalHeight,
        time,
        name: file.name,
        caption: "",
        pageId: null,
      });
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export const useAlbum = create<AlbumState>((set, get) => ({
  photos: [],
  pages: [],
  format: "square",

  importFiles: async (files) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) return;
    const loaded = (await Promise.all(list.map(loadPhoto))).filter(
      (p): p is Photo => p !== null,
    );
    set((s) => {
      const photos = [...s.photos, ...loaded].sort((a, b) => a.time - b.time);
      // First import seeds the pages; later imports drop into the library.
      const pages = s.pages.length === 0 ? distribute(photos) : s.pages;
      return { photos, pages };
    });
  },

  loadDemo: () => {
    const photos = makeDemoPhotos();
    set({ photos, pages: distribute(photos) });
  },

  autoDistribute: () => {
    const photos = [...get().photos].sort((a, b) => a.time - b.time);
    photos.forEach((p) => (p.pageId = null));
    set({ photos, pages: distribute(photos) });
  },

  placeOnPage: (photoId, pageId) =>
    set((s) => {
      const photos = s.photos.map((p) => ({ ...p }));
      const pages = s.pages.map((pg) => ({ ...pg, photoIds: [...pg.photoIds] }));
      const photo = photos.find((p) => p.id === photoId);
      const target = pages.find((pg) => pg.id === pageId);
      if (!photo || !target) return {};
      if (photo.pageId) {
        const old = pages.find((pg) => pg.id === photo.pageId);
        if (old) old.photoIds = old.photoIds.filter((id) => id !== photoId);
      }
      target.photoIds.push(photoId);
      photo.pageId = pageId;
      pages.forEach(syncLayout);
      return { photos, pages };
    }),

  removeFromPage: (photoId) =>
    set((s) => {
      const photos = s.photos.map((p) => ({ ...p }));
      const pages = s.pages.map((pg) => ({ ...pg, photoIds: [...pg.photoIds] }));
      const photo = photos.find((p) => p.id === photoId);
      if (!photo || !photo.pageId) return {};
      const pg = pages.find((x) => x.id === photo.pageId);
      if (pg) pg.photoIds = pg.photoIds.filter((id) => id !== photoId);
      photo.pageId = null;
      pages.forEach(syncLayout);
      return { photos, pages };
    }),

  setPageCount: (pageId, n) =>
    set((s) => {
      const photos = s.photos.map((p) => ({ ...p }));
      const pages = s.pages.map((pg) => ({ ...pg, photoIds: [...pg.photoIds] }));
      const target = pages.find((pg) => pg.id === pageId);
      if (!target) return {};
      // Shrink: return the last photos to the library.
      while (target.photoIds.length > n) {
        const id = target.photoIds.pop()!;
        const p = photos.find((x) => x.id === id);
        if (p) p.pageId = null;
      }
      // Grow: pull the next unplaced photos (chronological order preserved).
      const pool = photos.filter((p) => p.pageId === null);
      while (target.photoIds.length < n && pool.length > 0) {
        const p = pool.shift()!;
        target.photoIds.push(p.id);
        p.pageId = target.id;
      }
      syncLayout(target);
      return { photos, pages };
    }),

  addPage: () => set((s) => ({ pages: [...s.pages, newPage()] })),

  deletePage: (pageId) =>
    set((s) => {
      const photos = s.photos.map((p) =>
        p.pageId === pageId ? { ...p, pageId: null } : p,
      );
      let pages = s.pages.filter((pg) => pg.id !== pageId);
      if (pages.length === 0) {
        pages = [newPage()];
      }
      return { photos, pages };
    }),

  setPageTitle: (pageId, title) =>
    set((s) => ({
      pages: s.pages.map((pg) => (pg.id === pageId ? { ...pg, title } : pg)),
    })),

  setPageWhitespace: (pageId, whitespace) =>
    set((s) => ({
      pages: s.pages.map((pg) => (pg.id === pageId ? { ...pg, whitespace } : pg)),
    })),

  setPageLayout: (pageId, layoutId) =>
    set((s) => ({
      pages: s.pages.map((pg) => (pg.id === pageId ? { ...pg, layoutId } : pg)),
    })),

  setCaption: (photoId, caption) =>
    set((s) => ({
      photos: s.photos.map((p) => (p.id === photoId ? { ...p, caption } : p)),
    })),

  setFormat: (format) => set({ format }),
  reset: () => set({ photos: [], pages: [] }),
}));
