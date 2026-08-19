import { create } from "zustand";
import {
  DEFAULT_WHITESPACE,
  DEFAULT_LAYOUT_ID,
  DEFAULT_PROJECT_NAME,
  type AlbumPage,
  type Cover,
  type CoverFace,
  type CropFocus,
  type PageFill,
  type Photo,
  type Spine,
} from "./types";
import { DEFAULT_BOOK_SIZE, type BookSizeId } from "./lib/book-sizes";
import { readCaptureTime } from "./lib/exif";
import { makeDemoPhotos } from "./lib/demo";
import { defaultLayoutId, getLayout } from "./lib/layouts";
import {
  DEFAULT_COLOR_THEME,
  DEFAULT_FONT_THEME,
  colorThemeOrDefault,
  fontThemeOrDefault,
  type ColorThemeId,
  type FontThemeId,
} from "./lib/themes";
import {
  DEFAULT_TEXT_SIZES,
  textSizesOrDefault,
  type TextRole,
  type TextSizeLevel,
  type TextSizes,
} from "./lib/text-sizes";
import {
  bookSizeOfDoc,
  cleanCover,
  coverOrDefault,
  duplicateDoc,
  hydratePhotos,
  metaOf,
  newCover,
  newProjectDoc,
  newSpine,
  serializeProject,
  spineOfDoc,
  type ProjectMeta,
} from "./lib/project";
import * as db from "./persistence";

const DEFAULT_PER_PAGE = 3;
const SAVE_DEBOUNCE_MS = 400;

// Map a cover face to its state / document field.
const COVER_KEY: Record<
  CoverFace,
  "frontCover" | "insideFrontCover" | "insideBackCover" | "backCover"
> = {
  front: "frontCover",
  insideFront: "insideFrontCover",
  insideBack: "insideBackCover",
  back: "backCover",
};

function newPage(): AlbumPage {
  return {
    id: crypto.randomUUID(),
    title: "",
    subtitle: "",
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
  // Full-page mode is only meaningful for a single photo; drop it otherwise so a page
  // reverts to its normal layout when it gains or loses photos (spec 012).
  if (count !== 1 && page.fullPage !== undefined) {
    page.fullPage = undefined;
  }
}

// Revoke the object URLs of a set of photos before we drop or replace them, so we
// do not leak blobs when switching projects.
function revokeUrls(photos: Photo[]): void {
  for (const p of photos) {
    if (p.url.startsWith("blob:")) URL.revokeObjectURL(p.url);
  }
}

// Insert or replace a project meta, keeping the list newest-first.
function upsertMeta(list: ProjectMeta[], meta: ProjectMeta): ProjectMeta[] {
  return [meta, ...list.filter((m) => m.id !== meta.id)].sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );
}

interface AlbumState {
  photos: Photo[];
  pages: AlbumPage[];
  bookSize: BookSizeId;
  spine: Spine;
  fontTheme: FontThemeId;
  colorTheme: ColorThemeId;
  textSizes: TextSizes;

  // The four cover faces of the active project (see CoverFace)
  frontCover: Cover;
  insideFrontCover: Cover;
  insideBackCover: Cover;
  backCover: Cover;
  updateCover: (which: CoverFace, patch: Partial<Cover>) => void;

  // Projects
  projects: ProjectMeta[];
  activeId: string | null;
  activeName: string;
  activeCreatedAt: number;
  ready: boolean; // initial load finished
  persistent: boolean; // IndexedDB usable in this environment

  initProjects: () => Promise<void>;
  createProject: (name?: string) => Promise<void>;
  openProject: (id: string) => Promise<void>;
  renameProject: (id: string, name: string) => Promise<void>;
  duplicateProject: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;

  importFiles: (files: FileList | File[]) => Promise<void>;
  loadDemo: () => Promise<void>;

  placeOnPage: (photoId: string, pageId: string) => void;
  removeFromPage: (photoId: string) => void;
  setPageCount: (pageId: string, n: number) => void;

  addPage: () => void;
  deletePage: (pageId: string) => void;
  movePage: (pageId: string, toIndex: number) => void;
  setPageTitle: (pageId: string, title: string) => void;
  setPageSubtitle: (pageId: string, subtitle: string) => void;
  setPageWhitespace: (pageId: string, whitespace: number) => void;
  setPageLayout: (pageId: string, layoutId: string) => void;
  setPageFullPage: (pageId: string, mode: PageFill | null) => void;
  setPageFullPageFocus: (pageId: string, focus: CropFocus) => void;
  setCaption: (photoId: string, caption: string) => void;

  setBookSize: (bookSize: BookSizeId) => void;
  setSpineTitle: (title: string) => void;
  setFontTheme: (fontTheme: FontThemeId) => void;
  setColorTheme: (colorTheme: ColorThemeId) => void;
  setTextSize: (role: TextRole, level: TextSizeLevel) => void;
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

// Load one File into a Photo (with a runtime object URL) plus the File itself so the
// caller can persist the blob. Returns null if the image cannot be decoded.
async function loadPhoto(file: File): Promise<{ photo: Photo; file: File } | null> {
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
        file,
        photo: {
          id: crypto.randomUUID(),
          url,
          w: img.naturalWidth,
          h: img.naturalHeight,
          ratio: img.naturalWidth / img.naturalHeight,
          time,
          name: file.name,
          caption: "",
          pageId: null,
        },
      });
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export const useAlbum = create<AlbumState>((set, get) => {
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  // Persist the active project's document (debounced). Image blobs are written once
  // at import time, so this only writes the small metadata doc.
  const flushSave = async () => {
    saveTimer = null;
    const s = get();
    if (!s.persistent || !s.activeId) return;
    const doc = serializeProject(
      {
        id: s.activeId,
        name: s.activeName,
        createdAt: s.activeCreatedAt,
        bookSize: s.bookSize,
        spine: s.spine,
        fontTheme: s.fontTheme,
        colorTheme: s.colorTheme,
        textSizes: s.textSizes,
        photos: s.photos,
        pages: s.pages,
        frontCover: s.frontCover,
        insideFrontCover: s.insideFrontCover,
        insideBackCover: s.insideBackCover,
        backCover: s.backCover,
      },
      Date.now(),
    );
    try {
      await db.saveProjectDoc(doc);
      set((st) => ({ projects: upsertMeta(st.projects, metaOf(doc)) }));
    } catch {
      /* keep working in memory; a transient write error must not break editing */
    }
  };

  const scheduleSave = () => {
    if (!get().persistent || !get().activeId) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void flushSave(), SAVE_DEBOUNCE_MS);
  };

  const cancelSave = () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
  };

  // Flush any pending debounced save NOW, under the CURRENT active project. Call this
  // before switching/creating a project so the outgoing project's last edits persist
  // and no stale timer later writes under the wrong (or a deleted) id.
  const flushPending = async () => {
    if (!saveTimer) return;
    cancelSave();
    await flushSave();
  };

  // Make sure there is an active project to save into before the first import/demo.
  const ensureActiveProject = async () => {
    if (!get().activeId) await get().createProject();
  };

  // Best-effort flush when the tab is hidden/closed, to shrink the window where an
  // edit made within the debounce interval would be lost on a refresh.
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") void flushPending();
    });
  }

  return {
    photos: [],
    pages: [],
    bookSize: DEFAULT_BOOK_SIZE,
    spine: newSpine(),
    fontTheme: DEFAULT_FONT_THEME,
    colorTheme: DEFAULT_COLOR_THEME,
    textSizes: { ...DEFAULT_TEXT_SIZES },

    frontCover: newCover(),
    insideFrontCover: newCover(),
    insideBackCover: newCover(),
    backCover: newCover(),

    updateCover: (which, patch) => {
      const key = COVER_KEY[which];
      set((s) => ({ [key]: { ...s[key], ...patch } }));
      scheduleSave();
    },

    projects: [],
    activeId: null,
    activeName: DEFAULT_PROJECT_NAME,
    activeCreatedAt: 0,
    ready: false,
    persistent: false,

    initProjects: async () => {
      const available = await db.isAvailable();
      if (!available) {
        set({ ready: true, persistent: false });
        return;
      }
      set({ persistent: true });
      let projects: ProjectMeta[] = [];
      try {
        projects = await db.listProjects();
      } catch {
        set({ ready: true, persistent: false });
        return;
      }
      const lastId = db.getLastActiveId();
      const target = projects.find((p) => p.id === lastId) ?? projects[0];
      if (target) {
        await get().openProject(target.id);
      }
      set({ projects, ready: true });
    },

    createProject: async (name) => {
      await flushPending(); // persist the outgoing project before switching away
      const now = Date.now();
      const doc = newProjectDoc(name?.trim() || DEFAULT_PROJECT_NAME, now);
      revokeUrls(get().photos);
      if (get().persistent) {
        try {
          await db.saveProjectDoc(doc);
        } catch {
          /* degrade to in-memory */
        }
      }
      set((s) => ({
        projects: upsertMeta(s.projects, metaOf(doc)),
        activeId: doc.id,
        activeName: doc.name,
        activeCreatedAt: doc.createdAt,
        photos: [],
        pages: doc.pages,
        bookSize: doc.bookSize,
        spine: doc.spine,
        fontTheme: doc.fontTheme,
        colorTheme: doc.colorTheme,
        textSizes: doc.textSizes,
        frontCover: doc.frontCover,
        insideFrontCover: doc.insideFrontCover,
        insideBackCover: doc.insideBackCover,
        backCover: doc.backCover,
      }));
      db.setLastActiveId(doc.id);
    },

    openProject: async (id) => {
      if (!get().persistent) return;
      await flushPending(); // persist the outgoing project before loading the new one
      const doc = await db.loadProjectDoc(id);
      if (!doc) return;
      // Recreate object URLs from the stored blobs.
      const urls = new Map<string, string>();
      await Promise.all(
        doc.photos.map(async (p) => {
          const blob = await db.getImage(p.id).catch(() => undefined);
          if (blob) urls.set(p.id, URL.createObjectURL(blob));
        }),
      );
      revokeUrls(get().photos);
      const photos = hydratePhotos(doc, (pid) => urls.get(pid));
      // Drop any page reference to a photo whose blob was missing, then re-sync layouts.
      const existing = new Set(photos.map((p) => p.id));
      const pages = doc.pages.map((pg) => ({
        ...pg,
        subtitle: pg.subtitle ?? "", // normalize pages saved before page subtitles existed
        photoIds: pg.photoIds.filter((pid) => existing.has(pid)),
      }));
      pages.forEach(syncLayout);
      set({
        activeId: doc.id,
        activeName: doc.name,
        activeCreatedAt: doc.createdAt,
        bookSize: bookSizeOfDoc(doc),
        spine: spineOfDoc(doc),
        fontTheme: fontThemeOrDefault(doc.fontTheme).id,
        colorTheme: colorThemeOrDefault(doc.colorTheme).id,
        textSizes: textSizesOrDefault(doc.textSizes),
        photos,
        pages,
        frontCover: cleanCover(coverOrDefault(doc.frontCover), existing),
        insideFrontCover: cleanCover(coverOrDefault(doc.insideFrontCover), existing),
        insideBackCover: cleanCover(coverOrDefault(doc.insideBackCover), existing),
        backCover: cleanCover(coverOrDefault(doc.backCover), existing),
      });
      db.setLastActiveId(doc.id);
    },

    renameProject: async (id, name) => {
      const nm = name.trim() || DEFAULT_PROJECT_NAME;
      set((s) => ({
        projects: s.projects.map((m) => (m.id === id ? { ...m, name: nm } : m)),
        activeName: s.activeId === id ? nm : s.activeName,
      }));
      if (!get().persistent) return;
      if (get().activeId === id) {
        scheduleSave();
        return;
      }
      try {
        const doc = await db.loadProjectDoc(id);
        if (doc) await db.saveProjectDoc({ ...doc, name: nm, updatedAt: Date.now() });
      } catch {
        /* ignore */
      }
    },

    duplicateProject: async (id) => {
      if (!get().persistent) return;
      await flushPending(); // persist the active project before opening the copy
      const src = await db.loadProjectDoc(id);
      if (!src) return;
      const now = Date.now();
      const photoIdMap = new Map(src.photos.map((p) => [p.id, crypto.randomUUID()]));
      const dup = duplicateDoc(src, {
        id: crypto.randomUUID(),
        name: `${src.name} copy`,
        now,
        photoIdMap,
      });
      try {
        await Promise.all([...photoIdMap].map(([from, to]) => db.copyImage(from, to)));
        await db.saveProjectDoc(dup);
      } catch {
        return;
      }
      set((s) => ({ projects: upsertMeta(s.projects, metaOf(dup)) }));
      await get().openProject(dup.id);
    },

    deleteProject: async (id) => {
      // Cancel (do NOT flush) a pending save for the project being deleted, or the
      // timer would re-write the doc mid-delete and resurrect it as a ghost.
      if (get().activeId === id) cancelSave();
      if (get().persistent) {
        try {
          await db.deleteProject(id);
        } catch {
          /* ignore */
        }
      }
      const remaining = get().projects.filter((m) => m.id !== id);
      set({ projects: remaining });
      if (get().activeId !== id) return;
      const next = remaining[0]; // newest first
      if (next) {
        await get().openProject(next.id);
      } else {
        revokeUrls(get().photos);
        set({
          activeId: null,
          photos: [],
          pages: [],
          bookSize: DEFAULT_BOOK_SIZE,
          spine: newSpine(),
          fontTheme: DEFAULT_FONT_THEME,
          colorTheme: DEFAULT_COLOR_THEME,
          textSizes: { ...DEFAULT_TEXT_SIZES },
        });
        db.setLastActiveId(null);
      }
    },

    importFiles: async (files) => {
      const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (list.length === 0) return;
      await ensureActiveProject();
      const loaded = (await Promise.all(list.map(loadPhoto))).filter(
        (x): x is { photo: Photo; file: File } => x !== null,
      );
      if (get().persistent) {
        await Promise.all(
          loaded.map(({ photo, file }) => db.putImage(photo.id, file).catch(() => {})),
        );
      }
      const added = loaded.map((l) => l.photo);
      set((s) => {
        const photos = [...s.photos, ...added].sort((a, b) => a.time - b.time);
        // First import seeds the pages; later imports drop into the library.
        const pages = s.pages.length === 0 ? distribute(photos) : s.pages;
        return { photos, pages };
      });
      scheduleSave();
    },

    loadDemo: async () => {
      await ensureActiveProject();
      const demo = await makeDemoPhotos();
      if (get().persistent) {
        await Promise.all(demo.map(({ photo, blob }) => db.putImage(photo.id, blob).catch(() => {})));
      }
      revokeUrls(get().photos);
      const photos = demo.map((d) => d.photo);
      set({ photos, pages: distribute(photos) });
      scheduleSave();
    },

    placeOnPage: (photoId, pageId) => {
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
      });
      scheduleSave();
    },

    removeFromPage: (photoId) => {
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
      });
      scheduleSave();
    },

    setPageCount: (pageId, n) => {
      set((s) => {
        const photos = s.photos.map((p) => ({ ...p }));
        const pages = s.pages.map((pg) => ({ ...pg, photoIds: [...pg.photoIds] }));
        const targetIdx = pages.findIndex((pg) => pg.id === pageId);
        if (targetIdx === -1) return {};
        const target = pages[targetIdx];
        const byId = (id: string) => photos.find((p) => p.id === id);
        // Shrink: return the last photos to the library.
        while (target.photoIds.length > n) {
          const id = target.photoIds.pop()!;
          const p = byId(id);
          if (p) p.pageId = null;
        }
        // Grow: pull the next photos in order, first from the library (unplaced),
        // then by borrowing from the following pages, so raising the count always
        // works even after every photo has been distributed.
        const laterPageIds = new Set(pages.slice(targetIdx + 1).map((pg) => pg.id));
        const candidates = [
          ...photos.filter((p) => p.pageId === null),
          ...pages
            .slice(targetIdx + 1)
            .flatMap((pg) => pg.photoIds.map(byId).filter((p): p is Photo => !!p)),
        ];
        let ci = 0;
        while (target.photoIds.length < n && ci < candidates.length) {
          const p = candidates[ci++];
          if (p.pageId && laterPageIds.has(p.pageId)) {
            const old = pages.find((pg) => pg.id === p.pageId);
            if (old) old.photoIds = old.photoIds.filter((id) => id !== p.id);
          }
          target.photoIds.push(p.id);
          p.pageId = target.id;
        }
        // Counts on the target and any borrowed-from pages changed: re-sync all.
        pages.forEach(syncLayout);
        return { photos, pages };
      });
      scheduleSave();
    },

    addPage: () => {
      set((s) => ({ pages: [...s.pages, newPage()] }));
      scheduleSave();
    },

    deletePage: (pageId) => {
      set((s) => {
        const photos = s.photos.map((p) =>
          p.pageId === pageId ? { ...p, pageId: null } : p,
        );
        let pages = s.pages.filter((pg) => pg.id !== pageId);
        if (pages.length === 0) {
          pages = [newPage()];
        }
        return { photos, pages };
      });
      scheduleSave();
    },

    // Reorder content pages only (covers are separate state, never affected). `toIndex`
    // is an insertion slot in [0, pages.length]: slot 0 = before the first page, slot
    // length = after the last. Photos reference pageId (not an index), so nothing else
    // changes. A drop back into the page's own neighborhood is a no-op.
    movePage: (pageId, toIndex) => {
      set((s) => {
        const from = s.pages.findIndex((pg) => pg.id === pageId);
        if (from === -1) return {};
        const n = s.pages.length;
        let to = Math.max(0, Math.min(toIndex, n));
        if (to > from) to -= 1; // account for removing the dragged page first
        if (to === from) return {};
        const pages = [...s.pages];
        const [moved] = pages.splice(from, 1);
        pages.splice(to, 0, moved);
        return { pages };
      });
      scheduleSave();
    },

    setPageTitle: (pageId, title) => {
      set((s) => ({
        pages: s.pages.map((pg) => (pg.id === pageId ? { ...pg, title } : pg)),
      }));
      scheduleSave();
    },

    setPageSubtitle: (pageId, subtitle) => {
      set((s) => ({
        pages: s.pages.map((pg) => (pg.id === pageId ? { ...pg, subtitle } : pg)),
      }));
      scheduleSave();
    },

    setPageWhitespace: (pageId, whitespace) => {
      set((s) => ({
        pages: s.pages.map((pg) => (pg.id === pageId ? { ...pg, whitespace } : pg)),
      }));
      scheduleSave();
    },

    setPageLayout: (pageId, layoutId) => {
      set((s) => ({
        pages: s.pages.map((pg) => (pg.id === pageId ? { ...pg, layoutId } : pg)),
      }));
      scheduleSave();
    },

    setPageFullPage: (pageId, mode) => {
      set((s) => ({
        pages: s.pages.map((pg) =>
          pg.id === pageId ? { ...pg, fullPage: mode ?? undefined } : pg,
        ),
      }));
      scheduleSave();
    },

    setPageFullPageFocus: (pageId, focus) => {
      const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
      const f = { x: clamp01(focus.x), y: clamp01(focus.y) };
      set((s) => ({
        pages: s.pages.map((pg) => (pg.id === pageId ? { ...pg, fullPageFocus: f } : pg)),
      }));
      scheduleSave();
    },

    setCaption: (photoId, caption) => {
      set((s) => ({
        photos: s.photos.map((p) => (p.id === photoId ? { ...p, caption } : p)),
      }));
      scheduleSave();
    },

    setBookSize: (bookSize) => {
      set({ bookSize });
      scheduleSave();
    },

    setSpineTitle: (title) => {
      set({ spine: { title } });
      scheduleSave();
    },

    setFontTheme: (fontTheme) => {
      set({ fontTheme });
      scheduleSave();
    },

    setColorTheme: (colorTheme) => {
      set({ colorTheme });
      scheduleSave();
    },

    setTextSize: (role, level) => {
      set((s) => ({ textSizes: { ...s.textSizes, [role]: level } }));
      scheduleSave();
    },
  };
});
