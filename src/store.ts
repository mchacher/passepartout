import { create } from "zustand";
import {
  DEFAULT_WHITESPACE,
  DEFAULT_LAYOUT_ID,
  DEFAULT_PROJECT_NAME,
  type AlbumPage,
  type CellRect,
  type Cover,
  type CoverFace,
  type CropFocus,
  type CropRect,
  type PageFill,
  type Photo,
  type Spine,
} from "./types";
import { clampCrop } from "./lib/crop";
import { isMask, roundedRadiusOf } from "./lib/masks";
import { borderWidthOf, frameColorOf, isFrame } from "./lib/frames";
import { clampRotation } from "./lib/rotation";
import { DEFAULT_BOOK_SIZE, type BookSizeId } from "./lib/book-sizes";
import { readCaptureTime } from "./lib/exif";
import { defaultLayoutId, slotCount } from "./lib/layouts";
import { splitDuplicates } from "./lib/dedupe";
import { popHistory, pushHistory, type HistoryEntry } from "./lib/history";
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
import { initBackend, pingServerVersion, type PersistenceBackend, type VersionInfo, type User, type ActionResult } from "./persistence";
import { buildBundle, parseBundle, BundleError } from "./lib/bundle";
import {
  readUpdateLock,
  writeUpdateLock,
  clearUpdateLock,
  isLockActive,
  UPDATE_TIMEOUT_MS,
  UPDATE_POLL_MS,
  type UpdateLock,
} from "./lib/update-lock";

const SAVE_DEBOUNCE_MS = 400;
// Undo depth (spec 037). Snapshots are metadata only, so fifty of them cost little, and it is
// far more than the handful of steps anyone walks back in practice.
const HISTORY_LIMIT = 50;

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

// Keep a page's invariants around its SLOT COUNT (spec 035). The slot count is the layout
// capacity (see slotCount), independent of how many photos are placed; this repairs a page
// whose capacity fell below its photos (only reachable when a drag overflowed) and clears
// modes that no longer apply. It never shrinks the capacity down to the photo count: empty
// slots are intentional.
function syncLayout(page: AlbumPage): void {
  const photos = page.photoIds.length;
  let slots = slotCount(page.layoutId, photos, page.placement);
  // A page must always have room for its photos; grow the layout if a drop overflowed.
  if (slots < photos) {
    page.layoutId = defaultLayoutId(photos);
    page.placement = undefined;
    slots = slotCount(page.layoutId, photos, page.placement);
  }
  // Full-page mode is only meaningful for a single-slot page (spec 012).
  if (slots !== 1 && page.fullPage !== undefined) {
    page.fullPage = undefined;
  }
  // A custom grid placement is one rectangle per SLOT; drop a stale one (spec 013).
  if (page.placement && page.placement.length !== slots) {
    page.placement = undefined;
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
  persistent: boolean; // storage usable (IndexedDB present, or a server reachable)
  remote: boolean; // true when backed by the server API (spec 024)
  authed: boolean; // remote mode: whether a user session is active
  needsSetup: boolean; // remote mode: no users yet -> show first-run setup (spec 026)
  currentUser: User | null; // the logged-in user (remote mode)
  users: User[]; // account list (remote mode; loaded on demand)

  // Update/version (spec 025): null until first checked (remote mode).
  versionInfo: VersionInfo | null;
  versionChecking: boolean; // a manual "check for updates" is in flight (spec 027)
  refreshVersion: (force?: boolean) => Promise<void>;
  applyUpdate: () => Promise<{ started: boolean; inProgress?: boolean; error?: string; manualCommand?: string }>;

  // Non-interruptible update lock (spec 031): non-null while an update runs. Persisted to
  // localStorage so a page refresh keeps the lock (the user cannot re-trigger or interrupt it).
  updating: UpdateLock | null;
  beginUpdate: () => Promise<{ locked: boolean; error?: string; manualCommand?: string }>;
  dismissUpdate: () => void;

  initProjects: () => Promise<void>;
  // Auth & users (spec 026).
  setup: (username: string, password: string) => Promise<ActionResult>;
  login: (username: string, password: string) => Promise<ActionResult>;
  logout: () => Promise<void>;
  refreshUsers: () => Promise<void>;
  addUser: (username: string, password: string) => Promise<ActionResult>;
  deleteUser: (id: string) => Promise<ActionResult>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<ActionResult>;
  createProject: (name?: string) => Promise<void>;
  openProject: (id: string) => Promise<void>;
  renameProject: (id: string, name: string) => Promise<void>;
  duplicateProject: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;

  // Backup & transfer (spec 021): export the active project as a portable bundle, or
  // import a bundle as a new project.
  exportBundle: () => Promise<{ bytes: Uint8Array; name: string } | null>;
  // `code` is a stable error id (spec 032) so the UI can show a translated message; `error` is the
  // English fallback text.
  importBundle: (file: File) => Promise<{ ok: true } | { ok: false; error: string; code: string }>;

  // Undo / redo (spec 037). The stacks hold whole album snapshots; they live in the session
  // and are cleared whenever another project becomes the active one.
  undoStack: HistoryEntry<AlbumDocument>[];
  redoStack: HistoryEntry<AlbumDocument>[];
  undo: () => void;
  redo: () => void;

  importFiles: (files: FileList | File[]) => Promise<void>;
  // How many files the last import skipped as duplicates (issue 65). The Library shows the
  // notice; the next import replaces it and `dismissSkippedDuplicates` clears it.
  skippedDuplicates: number;
  dismissSkippedDuplicates: () => void;
  // Remove a photo from the album entirely (issue 66): the library, every page, every cover
  // face, and the stored blob.
  deletePhoto: (photoId: string) => void;

  placeOnPage: (photoId: string, pageId: string) => void;
  removeFromPage: (photoId: string, pageId: string) => void;
  unplaceFromAllPages: (photoId: string) => void;
  swapPhotosOnPage: (pageId: string, i: number, j: number) => void;
  setPageCount: (pageId: string, n: number) => void;

  addPage: () => void;
  insertPage: (index: number) => void;
  deletePage: (pageId: string) => void;
  movePage: (pageId: string, toIndex: number) => void;
  setPageTitle: (pageId: string, title: string) => void;
  setPageSubtitle: (pageId: string, subtitle: string) => void;
  setPageWhitespace: (pageId: string, whitespace: number) => void;
  setPageLayout: (pageId: string, layoutId: string) => void;
  setPagePlacement: (pageId: string, placement: CellRect[]) => void;
  setPageFullPage: (pageId: string, mode: PageFill | null) => void;
  setPageFullPageFocus: (pageId: string, focus: CropFocus) => void;
  setCaption: (photoId: string, caption: string) => void;
  setPhotoCrop: (photoId: string, crop: CropRect | null) => void;
  setPhotoMask: (photoId: string, maskId: string | null) => void;
  setPhotoMaskRadius: (photoId: string, value: number) => void;
  setPhotoFrame: (photoId: string, frameId: string | null) => void;
  setPhotoFrameColor: (photoId: string, colorId: string | null) => void;
  setPhotoFrameText: (photoId: string, text: string) => void;
  setPhotoFrameWidth: (photoId: string, width: number) => void;
  setPhotoFrameFocus: (photoId: string, focus: CropFocus) => void;
  setPhotoRotation: (photoId: string, deg: number) => void;

  setBookSize: (bookSize: BookSizeId) => void;
  setSpineTitle: (title: string) => void;
  setFontTheme: (fontTheme: FontThemeId) => void;
  setColorTheme: (colorTheme: ColorThemeId) => void;
  setTextSize: (role: TextRole, level: TextSizeLevel) => void;
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
        },
      });
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// The slice undo restores: exactly what serializeProject persists (spec 037). Compared by
// REFERENCE, so any action that produces a new array or object for one of these is recorded,
// and one that only touches session state (projects, version, the update lock) is not.
type AlbumDocument = Pick<
  AlbumState,
  | "photos"
  | "pages"
  | "bookSize"
  | "spine"
  | "fontTheme"
  | "colorTheme"
  | "textSizes"
  | "frontCover"
  | "insideFrontCover"
  | "insideBackCover"
  | "backCover"
>;

const DOCUMENT_KEYS = [
  "photos",
  "pages",
  "bookSize",
  "spine",
  "fontTheme",
  "colorTheme",
  "textSizes",
  "frontCover",
  "insideFrontCover",
  "insideBackCover",
  "backCover",
] as const satisfies readonly (keyof AlbumDocument)[];

const documentOf = (state: AlbumState): AlbumDocument => ({
  ...(Object.fromEntries(DOCUMENT_KEYS.map((k) => [k, state[k]])) as AlbumDocument),
  // Copy the page objects: syncLayout repairs a page IN PLACE, and a page left untouched by an
  // edit keeps its identity, so a snapshot holding the live object could be rewritten after the
  // fact and undo would restore an arrangement that never existed.
  pages: state.pages.map((pg) => ({ ...pg })),
});

const sameDocument = (a: AlbumState, b: AlbumState): boolean =>
  DOCUMENT_KEYS.every((k) => a[k] === b[k]);

export const useAlbum = create<AlbumState>((rawSet, get) => {
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  // Undo bookkeeping (spec 037). `recording` is off while an undo is being applied and while a
  // project loads: neither is an edit the user made.
  let recording = true;
  let pendingCoalesceKey: string | undefined;

  /**
   * `set` for the whole store, wrapped once so every album edit is recorded without each of
   * the thirty-odd actions having to remember to. The previous document is pushed only when
   * the document actually changed, which also means a future action gets undo for free.
   */
  const set: typeof rawSet = ((partial: unknown, replace?: never) => {
    const before = get();
    (rawSet as (p: unknown, r?: never) => void)(partial, replace);
    const key = pendingCoalesceKey;
    pendingCoalesceKey = undefined;
    if (!recording) return;
    const after = get();
    // A document that changes together with the active project is another album being loaded,
    // never an edit: history must not carry state from one project into the next. Handling it
    // here rather than at each load path means a new one cannot forget.
    if (before.activeId !== after.activeId) {
      rawSet({ undoStack: [], redoStack: [] });
      return;
    }
    if (sameDocument(before, after)) return;
    rawSet((st) => ({
      undoStack: pushHistory(st.undoStack, documentOf(before), { limit: HISTORY_LIMIT, coalesceKey: key, now: Date.now() }),
      redoStack: [], // a new edit abandons the branch that redo would have replayed
    }));
  }) as typeof rawSet;

  /** Mark the NEXT recorded step as mergeable with the previous one carrying the same key. */
  const coalesceAs = (key: string) => {
    pendingCoalesceKey = key;
  };

  /** Run a state change without recording it: loading a project, applying an undo. */
  const withoutRecording = (fn: () => void) => {
    recording = false;
    try {
      fn();
    } finally {
      recording = true;
    }
  };
  // The active persistence backend (local IndexedDB or the remote API), chosen by
  // initProjects via initBackend(). Every db call below goes through it (spec 024).
  let backend: PersistenceBackend;

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
      await backend.saveProjectDoc(doc);
      set((st) => ({ projects: upsertMeta(st.projects, metaOf(doc)) }));
    } catch {
      /* keep working in memory; a transient write error must not break editing */
    }
  };

  /**
   * Delete image blobs no project references any more (spec 037). Deleting a photo leaves its
   * bytes in place so undo can give it back; this is where they are actually reclaimed, one
   * start later, when the history that held them is long gone. Best effort throughout: a
   * failure here only means the bytes are swept next time.
   */
  const sweepOrphanImages = async (projects: ProjectMeta[]) => {
    try {
      const stored = await backend.listImageIds();
      if (stored.length === 0) return; // nothing stored, or a backend that cannot enumerate
      const referenced = new Set<string>();
      for (const meta of projects) {
        const doc = await backend.loadProjectDoc(meta.id);
        // A project whose document cannot be read tells us nothing about what it references.
        // Deleting on a partial picture could wipe a whole album's photos, so give up instead:
        // the bytes cost storage, losing them costs the user their album.
        if (!doc) return;
        for (const photo of doc.photos) referenced.add(photo.id);
      }
      // Anything the live album holds is off limits too: an import writes its blob before the
      // debounced save has put it in any document, and a second tab must not sweep it away.
      for (const photo of get().photos) referenced.add(photo.id);
      const orphans = stored.filter((id) => !referenced.has(id));
      await Promise.all(orphans.map((id) => backend.deleteImage(id).catch(() => {})));
    } catch {
      /* leave the bytes; the next start tries again */
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

  // Drive the update lock to completion (spec 031). Polls the server version directly (works even
  // while the API is mid-recreate); reloads the page once the target version is live. Marks the
  // lock `failed` after a safety timeout so the UI is never stuck forever. Idempotent per tick:
  // stops as soon as the lock is cleared or already failed.
  let updatePollTimer: ReturnType<typeof setTimeout> | null = null;
  const runUpdatePoll = () => {
    if (updatePollTimer) return; // a poll is already running in this tab
    const tick = async () => {
      updatePollTimer = null;
      const lock = get().updating;
      if (!lock || lock.failed) return;
      if (Date.now() - lock.startedAt > UPDATE_TIMEOUT_MS) {
        set({ updating: { ...lock, failed: true } });
        clearUpdateLock();
        return;
      }
      const info = await pingServerVersion();
      if (info) {
        set({ versionInfo: info });
        if (lock.target && info.current === lock.target) {
          clearUpdateLock();
          location.reload();
          return;
        }
      }
      updatePollTimer = setTimeout(() => void tick(), UPDATE_POLL_MS);
    };
    updatePollTimer = setTimeout(() => void tick(), UPDATE_POLL_MS);
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
      // Typing in a cover field coalesces per face AND per field, so the title and the
      // subtitle of the same cover stay two separate steps.
      coalesceAs(`cover:${which}:${Object.keys(patch).join(",")}`);
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
    remote: false,
    authed: false,
    needsSetup: false,
    currentUser: null,
    users: [],
    versionInfo: null,
    versionChecking: false,

    refreshVersion: async (force) => {
      if (!backend) return;
      if (force) set({ versionChecking: true });
      try {
        set({ versionInfo: await backend.version(force) });
      } catch {
        /* leave the previous value */
      } finally {
        if (force) set({ versionChecking: false });
      }
    },

    applyUpdate: async () => (backend ? backend.applyUpdate() : { started: false }),

    updating: null,

    // Start a one-click update and lock the UI (spec 031). Locks when the server confirms it
    // started, or reports one already in progress (a refresh mid-update lands here). Any other
    // failure returns unlocked with the real error so the caller can show the manual command.
    beginUpdate: async () => {
      if (!backend) return { locked: false };
      if (get().updating) return { locked: true }; // already locked in this tab
      const target = get().versionInfo?.latest ?? "";
      const res = await backend.applyUpdate();
      if (res.started || res.inProgress) {
        const lock: UpdateLock = { target, startedAt: Date.now() };
        writeUpdateLock(lock);
        set({ updating: lock });
        runUpdatePoll();
        return { locked: true };
      }
      return { locked: false, error: res.error, manualCommand: res.manualCommand };
    },

    // Release the lock. Only reachable from the "taking too long" recovery state - a running
    // update cannot be dismissed. Re-run init: a refresh mid-update short-circuits the normal
    // load, so recovering here must bring the app back to a proper state (auth + projects).
    dismissUpdate: () => {
      clearUpdateLock();
      set({ updating: null, ready: false });
      void get().initProjects();
    },

    initProjects: async () => {
      backend = await initBackend();
      set({ persistent: backend.persistent, remote: backend.mode === "remote" });

      // Restore a persisted update lock (spec 031) before anything else. During a one-click
      // update the containers are recreated, so a refresh here may have fallen back to local
      // mode - the lock (and its server-direct poll) must run regardless of backend. While an
      // update is in flight the overlay owns the screen; skip the normal project load.
      const lock = readUpdateLock();
      if (isLockActive(lock, Date.now())) {
        set({ updating: lock, ready: true });
        runUpdatePoll();
        return;
      }
      if (lock) clearUpdateLock(); // stale: the update finished or timed out while away

      // Remote mode (spec 026): route on the account status. No users -> first-run setup;
      // not logged in -> login. Either way stop here; setup()/login() re-run this to load.
      if (backend.mode === "remote") {
        const status = await backend.authStatus();
        set({ needsSetup: status.needsSetup, authed: status.authed });
        if (status.needsSetup || !status.authed) {
          set({ ready: true });
          return;
        }
        set({ currentUser: await backend.me() });
      } else if (!backend.persistent) {
        set({ ready: true });
        return;
      }

      let projects: ProjectMeta[];
      try {
        projects = await backend.listProjects();
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
      void sweepOrphanImages(projects); // reclaim what deleted photos left behind (spec 037)
      if (backend.mode === "remote") void get().refreshVersion(); // check for updates (spec 025)
    },

    setup: async (username, password) => {
      const res = await backend.setup(username, password);
      if (res.ok) {
        set({ needsSetup: false, authed: true });
        await get().initProjects();
      }
      return res;
    },

    login: async (username, password) => {
      const res = await backend.login(username, password);
      if (res.ok) {
        set({ authed: true });
        await get().initProjects(); // load projects now that the session is active
      }
      return res;
    },

    logout: async () => {
      await backend.logout();
      revokeUrls(get().photos);
      db.setLastActiveId(null);
      set({
        authed: false,
        currentUser: null,
        users: [],
        projects: [],
        activeId: null,
        activeName: DEFAULT_PROJECT_NAME,
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
      });
    },

    refreshUsers: async () => {
      if (!backend) return;
      set({ users: await backend.listUsers() });
    },

    addUser: async (username, password) => {
      const res = await backend.createUser(username, password);
      if (res.ok) await get().refreshUsers();
      return res;
    },

    deleteUser: async (id) => {
      const res = await backend.deleteUser(id);
      if (res.ok) {
        // Deleting your own account ends your session; reload to the login screen.
        if (get().currentUser?.id === id) {
          await get().logout();
        } else {
          await get().refreshUsers();
        }
      }
      return res;
    },

    changePassword: async (currentPassword, newPassword) => backend.changePassword(currentPassword, newPassword),

    createProject: async (name) => {
      await flushPending(); // persist the outgoing project before switching away
      const now = Date.now();
      const doc = newProjectDoc(name?.trim() || DEFAULT_PROJECT_NAME, now);
      revokeUrls(get().photos);
      if (get().persistent) {
        try {
          await backend.saveProjectDoc(doc);
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
      const doc = await backend.loadProjectDoc(id);
      if (!doc) return;
      // Resolve each photo's URL from the backend: object URLs from local blobs, or direct
      // /api/images URLs in remote mode (no blob download). See PersistenceBackend.imageUrls.
      const urls = await backend.imageUrls(doc.photos.map((p) => p.id));
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
        const doc = await backend.loadProjectDoc(id);
        if (doc) await backend.saveProjectDoc({ ...doc, name: nm, updatedAt: Date.now() });
      } catch {
        /* ignore */
      }
    },

    duplicateProject: async (id) => {
      if (!get().persistent) return;
      await flushPending(); // persist the active project before opening the copy
      const src = await backend.loadProjectDoc(id);
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
        await Promise.all([...photoIdMap].map(([from, to]) => backend.copyImage(from, to)));
        await backend.saveProjectDoc(dup);
      } catch {
        return;
      }
      set((s) => ({ projects: upsertMeta(s.projects, metaOf(dup)) }));
      await get().openProject(dup.id);
    },

    // Export the active project as a portable bundle (spec 021): its full document plus
    // every image blob, zipped. Serialized from the live state (freshest), with blobs read
    // from IndexedDB and, if a blob is missing there, fetched back from its object URL, so
    // export works even in a non-persistent session.
    exportBundle: async () => {
      const s = get();
      if (!s.activeId) return null;
      const now = Date.now();
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
        now,
      );
      const images = new Map<string, { bytes: Uint8Array; mime: string }>();
      for (const p of doc.photos) {
        let blob: Blob | undefined = s.persistent ? await backend.getImage(p.id).catch(() => undefined) : undefined;
        if (!blob) {
          const live = s.photos.find((x) => x.id === p.id);
          if (live) blob = await fetch(live.url).then((r) => r.blob()).catch(() => undefined);
        }
        if (blob) images.set(p.id, { bytes: new Uint8Array(await blob.arrayBuffer()), mime: blob.type || "image/jpeg" });
      }
      const bytes = buildBundle(doc, images, now);
      const safe = (s.activeName || "album").replace(/[^\w.-]+/g, "-");
      return { bytes, name: `${safe}.passepartout.zip` };
    },

    // Import a bundle as a NEW project (spec 021): parse, remap every id (so the copy owns
    // independent blobs, like duplicateProject), write the images and doc, then open it.
    // Existing projects are untouched; re-importing yields an independent copy.
    importBundle: async (file) => {
      if (!get().persistent) {
        return { ok: false, code: "import.no-save", error: "Saving is unavailable in this browser, so importing is disabled." };
      }
      let parsed;
      try {
        parsed = parseBundle(new Uint8Array(await file.arrayBuffer()));
      } catch (e) {
        if (e instanceof BundleError) return { ok: false, code: `bundle.${e.code}`, error: e.message };
        return { ok: false, code: "import.read-failed", error: "Could not read this file." };
      }
      await flushPending(); // persist the active project before opening the import
      const now = Date.now();
      const photoIdMap = new Map(parsed.doc.photos.map((p) => [p.id, crypto.randomUUID()]));
      const dup = duplicateDoc(parsed.doc, {
        id: crypto.randomUUID(),
        name: parsed.doc.name?.trim() || DEFAULT_PROJECT_NAME,
        now,
        photoIdMap,
      });
      try {
        await Promise.all(
          [...parsed.images].map(([oldId, img]) => {
            const newId = photoIdMap.get(oldId);
            return newId ? backend.putImage(newId, new Blob([img.bytes as BlobPart], { type: img.mime })) : Promise.resolve();
          }),
        );
        await backend.saveProjectDoc(dup);
      } catch {
        return { ok: false, code: "import.save-failed", error: "Could not save the imported album." };
      }
      set((s) => ({ projects: upsertMeta(s.projects, metaOf(dup)) }));
      await get().openProject(dup.id);
      return { ok: true };
    },

    deleteProject: async (id) => {
      // Cancel (do NOT flush) a pending save for the project being deleted, or the
      // timer would re-write the doc mid-delete and resurrect it as a ghost.
      if (get().activeId === id) cancelSave();
      if (get().persistent) {
        try {
          await backend.deleteProject(id);
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

    undoStack: [],
    redoStack: [],

    /** Take back the last album edit. A no-op with nothing recorded. */
    undo: () => {
      const popped = popHistory(get().undoStack);
      if (!popped) return;
      const current = documentOf(get());
      withoutRecording(() => {
        set({ ...popped.entry.snapshot, undoStack: popped.rest, redoStack: [...get().redoStack, { snapshot: current }] });
      });
      scheduleSave();
    },

    /** Put back the edit the last undo took away. A no-op with nothing to replay. */
    redo: () => {
      const popped = popHistory(get().redoStack);
      if (!popped) return;
      const current = documentOf(get());
      withoutRecording(() => {
        set({ ...popped.entry.snapshot, redoStack: popped.rest, undoStack: [...get().undoStack, { snapshot: current }] });
      });
      scheduleSave();
    },

    skippedDuplicates: 0,

    dismissSkippedDuplicates: () => set({ skippedDuplicates: 0 }),

    importFiles: async (files) => {
      const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (list.length === 0) return;
      await ensureActiveProject();
      const loaded = (await Promise.all(list.map(loadPhoto))).filter(
        (x): x is { photo: Photo; file: File } => x !== null,
      );
      // Never import the same photo twice (issue 65). Identity is name + pixel dimensions +
      // capture time, so the filter also catches a file selected twice in one batch. Split
      // BEFORE persisting: a skipped file must leave no blob and no dangling object URL.
      const { kept, skipped } = splitDuplicates(
        get().photos,
        loaded.map((l) => ({ ...l.photo, file: l.file })),
      );
      for (const dup of skipped) URL.revokeObjectURL(dup.url);
      set({ skippedDuplicates: skipped.length });
      if (kept.length === 0) return;
      if (get().persistent) {
        await Promise.all(kept.map(({ id, file }) => backend.putImage(id, file).catch(() => {})));
      }
      const added: Photo[] = kept.map(({ file: _file, ...photo }) => photo);
      set((s) => {
        const photos = [...s.photos, ...added].sort((a, b) => a.time - b.time);
        // Import never places photos on a page (spec 035): they stay in the library and the
        // user drags them onto pages. Seed one empty page when the album has none, so there
        // is somewhere to drag to.
        const pages = s.pages.length === 0 ? [newPage()] : s.pages;
        return { photos, pages };
      });
      // Save NOW rather than in 400 ms: the blobs are already written, and a document that
      // does not mention them yet is what makes another tab's orphan sweep dangerous.
      cancelSave();
      await flushSave();
    },

    placeOnPage: (photoId, pageId) => {
      set((s) => {
        const pages = s.pages.map((pg) => ({ ...pg, photoIds: [...pg.photoIds] }));
        const photo = s.photos.find((p) => p.id === photoId);
        const target = pages.find((pg) => pg.id === pageId);
        if (!photo || !target) return {};
        // Reuse (spec 017): dropping a photo already on this page is a no-op (no duplicate).
        if (target.photoIds.includes(photoId)) return {};
        // A drop fills the next empty slot (spec 035). If the page had no free slot, grow the
        // layout so the new photo has a cell (reset any custom placement to the named layout).
        target.photoIds.push(photoId);
        if (slotCount(target.layoutId, target.photoIds.length, target.placement) < target.photoIds.length) {
          target.layoutId = defaultLayoutId(target.photoIds.length);
          target.placement = undefined;
        }
        pages.forEach(syncLayout);
        return { pages };
      });
      scheduleSave();
    },

    removeFromPage: (photoId, pageId) => {
      set((s) => {
        const pages = s.pages.map((pg) => ({ ...pg, photoIds: [...pg.photoIds] }));
        const pg = pages.find((x) => x.id === pageId);
        if (!pg || !pg.photoIds.includes(photoId)) return {};
        // Removing a photo leaves the slot empty; the page's capacity is unchanged (spec 035).
        // A custom placement keeps all its cells (one per slot); the freed cell just empties.
        pg.photoIds = pg.photoIds.filter((id) => id !== photoId);
        pages.forEach(syncLayout);
        return { pages };
      });
      scheduleSave();
    },

    // Swap two photos within one page by slot index (spec 056). Only the photoIds order
    // changes: the layout capacity and any custom placement (keyed by slot, not photo) are
    // untouched, so the two photos simply exchange positions. Out-of-range / equal indices
    // are a no-op.
    swapPhotosOnPage: (pageId, i, j) => {
      set((s) => {
        const target = s.pages.find((pg) => pg.id === pageId);
        if (!target) return {};
        const n = target.photoIds.length;
        if (i === j || i < 0 || j < 0 || i >= n || j >= n) return {};
        const pages = s.pages.map((pg) => {
          if (pg.id !== pageId) return pg;
          const photoIds = [...pg.photoIds];
          [photoIds[i], photoIds[j]] = [photoIds[j], photoIds[i]];
          return { ...pg, photoIds };
        });
        return { pages };
      });
      scheduleSave();
    },

    // Delete a photo from the album for good (issue 66): out of the library, off every page,
    // off every cover face using it, and the stored blob dropped. A page keeps its slot count
    // and its custom placement (one cell per SLOT, not per photo): the freed cell simply
    // empties, like removeFromPage. Unknown ids are a no-op.
    deletePhoto: (photoId) => {
      const target = get().photos.find((p) => p.id === photoId);
      if (!target) return;
      set((s) => {
        const pages = s.pages.map((pg) =>
          pg.photoIds.includes(photoId)
            ? { ...pg, photoIds: pg.photoIds.filter((id) => id !== photoId) }
            : pg,
        );
        pages.forEach(syncLayout);
        const clearCover = (c: Cover): Cover => (c.photoId === photoId ? { ...c, photoId: null } : c);
        return {
          photos: s.photos.filter((p) => p.id !== photoId),
          pages,
          frontCover: clearCover(s.frontCover),
          insideFrontCover: clearCover(s.insideFrontCover),
          insideBackCover: clearCover(s.insideBackCover),
          backCover: clearCover(s.backCover),
        };
      });
      // Neither the object URL nor the stored blob is dropped here (spec 037): undo has to be
      // able to give this photo back, still displaying. The bytes are swept at the next start,
      // once no project references them (sweepOrphanImages).
      scheduleSave();
    },

    // Drop a photo from every page that holds it (the Library is a drop target). Like
    // removeFromPage and deletePhoto, the page keeps its slot count AND its custom placement:
    // a placement is one rectangle per SLOT, not per photo, so the freed cell simply empties
    // (issue 70). Filtering the placement here used to leave it one cell short of the slot
    // count, and syncLayout then threw the user's whole arrangement away.
    unplaceFromAllPages: (photoId) => {
      set((s) => {
        if (!s.pages.some((pg) => pg.photoIds.includes(photoId))) return {};
        const pages = s.pages.map((pg) =>
          pg.photoIds.includes(photoId)
            ? { ...pg, photoIds: pg.photoIds.filter((id) => id !== photoId) }
            : pg,
        );
        pages.forEach(syncLayout);
        return { pages };
      });
      scheduleSave();
    },

    setPageCount: (pageId, n) => {
      // Re-clicking the active number is a no-op the user makes often on a segmented control;
      // recording it would spend an undo step on nothing (spec 037).
      const current = get().pages.find((pg) => pg.id === pageId);
      if (current && slotCount(current.layoutId, current.photoIds.length, current.placement) === n) return;
      set((s) => {
        const pages = s.pages.map((pg) => ({ ...pg, photoIds: [...pg.photoIds] }));
        const target = pages.find((pg) => pg.id === pageId);
        if (!target) return {};
        // Set the page's slot capacity to n (spec 035). Photos are NEVER pulled from the
        // library; the user fills the slots by dragging. Only change the layout when the
        // capacity actually changes, so re-clicking the active number keeps a chosen layout.
        if (n !== slotCount(target.layoutId, target.photoIds.length, target.placement)) {
          target.layoutId = defaultLayoutId(n); // default n-slot layout; a coarse reset
          target.placement = undefined;
          while (target.photoIds.length > n) target.photoIds.pop(); // overflow -> library
          if (n !== 1) target.fullPage = undefined;
        }
        pages.forEach(syncLayout);
        return { pages };
      });
      scheduleSave();
    },

    addPage: () => {
      set((s) => ({ pages: [...s.pages, newPage()] }));
      scheduleSave();
    },

    // Insert a fresh blank page at an arbitrary position (spec 053). `index` is an insertion
    // slot in [0, pages.length]: slot 0 = before the first page, slot length = after the last
    // (same model as movePage's toIndex). Out-of-range values are clamped. Covers/spine are
    // separate state and never affected.
    insertPage: (index) => {
      set((s) => {
        const at = Math.max(0, Math.min(index, s.pages.length));
        const pages = [...s.pages];
        pages.splice(at, 0, newPage());
        return { pages };
      });
      scheduleSave();
    },

    deletePage: (pageId) => {
      set((s) => {
        // The page's photos stay in the Library (they may be reused elsewhere); their
        // usage is simply recomputed from the remaining pages (spec 017).
        let pages = s.pages.filter((pg) => pg.id !== pageId);
        if (pages.length === 0) {
          pages = [newPage()];
        }
        return { pages };
      });
      scheduleSave();
    },

    // Reorder content pages only (covers are separate state, never affected). `toIndex`
    // is an insertion slot in [0, pages.length]: slot 0 = before the first page, slot
    // length = after the last. Each page owns its own photoIds (photos hold no placement),
    // so permuting the page array changes nothing else. A drop back into the page's own
    // neighborhood is a no-op.
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
      coalesceAs(`pageTitle:${pageId}`);
      set((s) => ({
        pages: s.pages.map((pg) => (pg.id === pageId ? { ...pg, title } : pg)),
      }));
      scheduleSave();
    },

    setPageSubtitle: (pageId, subtitle) => {
      coalesceAs(`pageSubtitle:${pageId}`);
      set((s) => ({
        pages: s.pages.map((pg) => (pg.id === pageId ? { ...pg, subtitle } : pg)),
      }));
      scheduleSave();
    },

    setPageWhitespace: (pageId, whitespace) => {
      coalesceAs(`whitespace:${pageId}`);
      set((s) => ({
        pages: s.pages.map((pg) => (pg.id === pageId ? { ...pg, whitespace } : pg)),
      }));
      scheduleSave();
    },

    setPageLayout: (pageId, layoutId) => {
      if (get().pages.find((pg) => pg.id === pageId)?.layoutId === layoutId) return; // already there
      // Re-selecting a template re-attaches the page: any custom placement is cleared.
      set((s) => ({
        pages: s.pages.map((pg) => (pg.id === pageId ? { ...pg, layoutId, placement: undefined } : pg)),
      }));
      scheduleSave();
    },

    setPagePlacement: (pageId, placement) => {
      set((s) => ({
        pages: s.pages.map((pg) => (pg.id === pageId ? { ...pg, placement } : pg)),
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
      // Fired on every pointermove while the photo is panned: one drag is one step.
      coalesceAs(`fullPageFocus:${pageId}`);
      const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
      const f = { x: clamp01(focus.x), y: clamp01(focus.y) };
      set((s) => ({
        pages: s.pages.map((pg) => (pg.id === pageId ? { ...pg, fullPageFocus: f } : pg)),
      }));
      scheduleSave();
    },

    setCaption: (photoId, caption) => {
      coalesceAs(`caption:${photoId}`);
      set((s) => ({
        photos: s.photos.map((p) => (p.id === photoId ? { ...p, caption } : p)),
      }));
      scheduleSave();
    },

    setPhotoCrop: (photoId, crop) => {
      const next = crop ? clampCrop(crop) : undefined;
      set((s) => ({
        photos: s.photos.map((p) => (p.id === photoId ? { ...p, crop: next } : p)),
      }));
      scheduleSave();
    },

    setPhotoMask: (photoId, maskId) => {
      if ((get().photos.find((p) => p.id === photoId)?.mask ?? null) === maskId) return; // already there
      // Only a known catalog id is kept; null or an unknown id clears the mask (spec 018).
      const next = maskId && isMask(maskId) ? maskId : undefined;
      set((s) => ({
        photos: s.photos.map((p) => (p.id === photoId ? { ...p, mask: next } : p)),
      }));
      scheduleSave();
    },

    setPhotoMaskRadius: (photoId, value) => {
      if (get().photos.find((p) => p.id === photoId)?.maskRadius === value) return; // already there
      // The rounded mask's corner size (spec 034), coerced to a valid fraction of the shorter side.
      const next = roundedRadiusOf(value);
      set((s) => ({
        photos: s.photos.map((p) => (p.id === photoId ? { ...p, maskRadius: next } : p)),
      }));
      scheduleSave();
    },

    setPhotoFrame: (photoId, frameId) => {
      // Only a known catalog id is kept; clearing the frame drops its note / width / focus.
      const next = frameId && isFrame(frameId) ? frameId : undefined;
      set((s) => ({
        photos: s.photos.map((p) =>
          p.id === photoId
            ? next
              ? { ...p, frame: next }
              : { ...p, frame: undefined, frameText: undefined, frameWidth: undefined, frameFocus: undefined }
            : p,
        ),
      }));
      scheduleSave();
    },

    setPhotoFrameColor: (photoId, colorId) => {
      if ((get().photos.find((p) => p.id === photoId)?.frameColor ?? null) === colorId) return; // already there
      const next = colorId && frameColorOf(colorId, colorId).id === colorId ? colorId : undefined;
      set((s) => ({
        photos: s.photos.map((p) => (p.id === photoId ? { ...p, frameColor: next } : p)),
      }));
      scheduleSave();
    },

    setPhotoFrameText: (photoId, text) => {
      coalesceAs(`frameText:${photoId}`);
      const next = text.trim().length > 0 ? text : undefined;
      set((s) => ({
        photos: s.photos.map((p) => (p.id === photoId ? { ...p, frameText: next } : p)),
      }));
      scheduleSave();
    },

    setPhotoFrameWidth: (photoId, width) => {
      if (get().photos.find((p) => p.id === photoId)?.frameWidth === width) return; // already there
      const next = borderWidthOf(width);
      set((s) => ({
        photos: s.photos.map((p) => (p.id === photoId ? { ...p, frameWidth: next } : p)),
      }));
      scheduleSave();
    },

    setPhotoFrameFocus: (photoId, focus) => {
      // Fired on every pointermove while the photo is panned: one drag is one step.
      coalesceAs(`frameFocus:${photoId}`);
      const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
      const f = { x: clamp01(focus.x), y: clamp01(focus.y) };
      set((s) => ({
        photos: s.photos.map((p) => (p.id === photoId ? { ...p, frameFocus: f } : p)),
      }));
      scheduleSave();
    },

    setPhotoRotation: (photoId, deg) => {
      // A decorative tilt (spec 020), clamped to the range; 0 clears the field.
      const next = clampRotation(deg) || undefined;
      set((s) => ({
        photos: s.photos.map((p) => (p.id === photoId ? { ...p, rotation: next } : p)),
      }));
      scheduleSave();
    },

    setBookSize: (bookSize) => {
      set({ bookSize });
      scheduleSave();
    },

    setSpineTitle: (title) => {
      coalesceAs("spineTitle");
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
      if (get().textSizes[role] === level) return; // already there
      set((s) => ({ textSizes: { ...s.textSizes, [role]: level } }));
      scheduleSave();
    },
  };
});
