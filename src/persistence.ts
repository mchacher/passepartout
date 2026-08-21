// The persistence adapter (impure): IndexedDB storage for projects and image blobs.
//
// This is the only module that talks to IndexedDB. It is kept out of src/lib/ (which
// stays pure) and is verified by fake-indexeddb tests plus driving the real app.
//
// Two stores:
//   - "projects": keyPath "id", holds a ProjectDoc (metadata + pages + photo records).
//   - "images":   out-of-line key = photo id, holds the original image Blob.
//
// A normal miss (no such project/image) resolves to undefined and never rejects.
// Genuine errors reject, and the store degrades to in-memory on top of that.

import { metaOf, type ProjectDoc, type ProjectMeta } from "./lib/project";

const DB_NAME = "passepartout";
const DB_VERSION = 1;
const PROJECTS = "projects";
const IMAGES = "images";
const LAST_ACTIVE_KEY = "passepartout.lastActiveProjectId";

let dbPromise: Promise<IDBDatabase> | null = null;

function hasIDB(): boolean {
  return typeof indexedDB !== "undefined";
}

/** Whether persistence can be used at all in this environment. */
export async function isAvailable(): Promise<boolean> {
  if (!hasIDB()) return false;
  try {
    await openDB();
    return true;
  } catch {
    return false;
  }
}

function openDB(): Promise<IDBDatabase> {
  if (!hasIDB()) return Promise.reject(new Error("IndexedDB unavailable"));
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(PROJECTS)) {
          db.createObjectStore(PROJECTS, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(IMAGES)) {
          db.createObjectStore(IMAGES); // out-of-line key = photo id
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function request<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = run(db.transaction(store, mode).objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

/** All project metas, newest first. */
export async function listProjects(): Promise<ProjectMeta[]> {
  const docs = await request<ProjectDoc[]>(PROJECTS, "readonly", (s) => s.getAll());
  return docs.map(metaOf).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadProjectDoc(id: string): Promise<ProjectDoc | undefined> {
  return request<ProjectDoc | undefined>(PROJECTS, "readonly", (s) => s.get(id));
}

export async function saveProjectDoc(doc: ProjectDoc): Promise<void> {
  await request(PROJECTS, "readwrite", (s) => s.put(doc));
}

export async function putImage(id: string, blob: Blob): Promise<void> {
  await request(IMAGES, "readwrite", (s) => s.put(blob, id));
}

export async function getImage(id: string): Promise<Blob | undefined> {
  return request<Blob | undefined>(IMAGES, "readonly", (s) => s.get(id));
}

/** Delete a project's doc and all of its image blobs in one transaction. */
export async function deleteProject(id: string): Promise<void> {
  const doc = await loadProjectDoc(id);
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction([PROJECTS, IMAGES], "readwrite");
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.objectStore(PROJECTS).delete(id);
    if (doc) for (const p of doc.photos) t.objectStore(IMAGES).delete(p.id);
  });
}

/** Copy an image blob from one photo id to another (used when duplicating). */
export async function copyImage(fromId: string, toId: string): Promise<void> {
  const blob = await getImage(fromId);
  if (blob) await putImage(toId, blob);
}

/** Wipe both stores. Handy for tests and a future "reset app" action. */
export async function clearAll(): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction([PROJECTS, IMAGES], "readwrite");
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.objectStore(PROJECTS).clear();
    t.objectStore(IMAGES).clear();
  });
}

// The pointer to the last-active project is a tiny string: localStorage is enough.
export function getLastActiveId(): string | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage.getItem(LAST_ACTIVE_KEY) : null;
  } catch {
    return null;
  }
}

export function setLastActiveId(id: string | null): void {
  try {
    if (typeof localStorage === "undefined") return;
    if (id === null) localStorage.removeItem(LAST_ACTIVE_KEY);
    else localStorage.setItem(LAST_ACTIVE_KEY, id);
  } catch {
    /* ignore quota / disabled storage */
  }
}

// ---------------------------------------------------------------------------
// Persistence backends (spec 024)
//
// The app talks to ONE backend, chosen at startup by initBackend():
//  - "local":  the IndexedDB functions above (the local-first default, spec 002).
//  - "remote": the server API at /api, when a backend is reachable (spec 024).
// The store consumes this interface and no longer cares which mode is active. The
// last-active pointer stays in localStorage in both modes (a per-browser convenience).
// ---------------------------------------------------------------------------

/** Update/version info (spec 025). `latest` is null when unknown (no token / local mode). */
export interface VersionInfo {
  current: string;
  latest: string | null;
  updateAvailable: boolean;
  canApply: boolean; // one-click possible (server has the Docker socket mounted)
}

/** Auth routing (spec 026): first-run setup vs login vs in. */
export interface AuthStatus {
  needsSetup: boolean;
  authed: boolean;
}

export interface User {
  id: string;
  username: string;
  createdAt?: number;
}

/** The result of an auth/user action, with a server message on failure. */
export type ActionResult = { ok: true } | { ok: false; error?: string };

export interface PersistenceBackend {
  mode: "local" | "remote";
  /** Whether projects can be saved at all (IndexedDB present, or a server is reachable). */
  persistent: boolean;
  listProjects(): Promise<ProjectMeta[]>;
  loadProjectDoc(id: string): Promise<ProjectDoc | undefined>;
  saveProjectDoc(doc: ProjectDoc): Promise<void>;
  putImage(id: string, blob: Blob): Promise<void>;
  getImage(id: string): Promise<Blob | undefined>;
  deleteProject(id: string): Promise<void>;
  copyImage(fromId: string, toId: string): Promise<void>;
  /** Display URLs for photo ids: object URLs (local) or /api/images URLs (remote). */
  imageUrls(ids: string[]): Promise<Map<string, string>>;
  // Auth & users (spec 026); trivial/no-op in local mode.
  authStatus(): Promise<AuthStatus>;
  me(): Promise<User | null>;
  setup(username: string, password: string): Promise<ActionResult>;
  login(username: string, password: string): Promise<ActionResult>;
  logout(): Promise<void>;
  listUsers(): Promise<User[]>;
  createUser(username: string, password: string): Promise<ActionResult>;
  deleteUser(id: string): Promise<ActionResult>;
  changePassword(currentPassword: string, newPassword: string): Promise<ActionResult>;
  /** Version/update info (spec 025); `force` skips the server cache for a manual check (027). */
  version(force?: boolean): Promise<VersionInfo>;
  /**
   * Trigger a one-click update (remote + Docker socket); no-op in local mode.
   * `inProgress` means an update is already running: the caller should lock the UI, not error.
   */
  applyUpdate(): Promise<{ started: boolean; inProgress?: boolean; error?: string; manualCommand?: string }>;
}

function makeLocalBackend(persistent: boolean): PersistenceBackend {
  return {
    mode: "local",
    persistent,
    listProjects,
    loadProjectDoc,
    saveProjectDoc,
    putImage,
    getImage,
    deleteProject,
    copyImage,
    async imageUrls(ids) {
      const urls = new Map<string, string>();
      for (const id of ids) {
        const blob = await getImage(id).catch(() => undefined);
        if (blob) urls.set(id, URL.createObjectURL(blob));
      }
      return urls;
    },
    // Local mode has no accounts: always "in", user actions are inert.
    async authStatus() {
      return { needsSetup: false, authed: true };
    },
    async me() {
      return null;
    },
    async setup() {
      return { ok: true };
    },
    async login() {
      return { ok: true };
    },
    async logout() {
      /* no auth in local mode */
    },
    async listUsers() {
      return [];
    },
    async createUser() {
      return { ok: false };
    },
    async deleteUser() {
      return { ok: false };
    },
    async changePassword() {
      return { ok: false };
    },
    async version() {
      return { current: __APP_VERSION__, latest: null, updateAvailable: false, canApply: false };
    },
    async applyUpdate() {
      return { started: false };
    },
  };
}

const API_BASE = "/api";
const api = (path: string, init?: RequestInit): Promise<Response> =>
  fetch(`${API_BASE}${path}`, { credentials: "same-origin", ...init });

/**
 * Fetch the server version directly, independent of the active backend (spec 031). The update
 * lock's poll uses this: during a one-click update the containers are recreated, so `initBackend`
 * may have briefly fallen back to local mode - the poll must still reach the server to learn when
 * the new version is live. Returns null while the server is unreachable (expected mid-recreate).
 */
export async function pingServerVersion(): Promise<VersionInfo | null> {
  try {
    const r = await api("/version");
    if (r.ok) return (await r.json()) as VersionInfo;
  } catch {
    /* server is down during recreation - keep waiting */
  }
  return null;
}

// POST a JSON body and map the response to an ActionResult, surfacing the server's error text.
async function postResult(path: string, body: unknown): Promise<ActionResult> {
  try {
    const r = await api(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (r.ok) return { ok: true };
    const b = (await r.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: b.error };
  } catch {
    return { ok: false, error: "network error" };
  }
}

const remoteBackend: PersistenceBackend = {
  mode: "remote",
  persistent: true,
  async listProjects() {
    const r = await api("/projects");
    if (!r.ok) throw new Error(`listProjects failed: ${r.status}`);
    return (await r.json()) as ProjectMeta[];
  },
  async loadProjectDoc(id) {
    const r = await api(`/projects/${id}`);
    if (r.status === 404) return undefined;
    if (!r.ok) throw new Error(`loadProjectDoc failed: ${r.status}`);
    return (await r.json()) as ProjectDoc;
  },
  async saveProjectDoc(doc) {
    const r = await api(`/projects/${doc.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(doc),
    });
    if (!r.ok) throw new Error(`saveProjectDoc failed: ${r.status}`);
  },
  async putImage(id, blob) {
    const r = await api(`/images/${id}`, {
      method: "PUT",
      headers: { "content-type": blob.type || "application/octet-stream" },
      body: blob,
    });
    if (!r.ok) throw new Error(`putImage failed: ${r.status}`);
  },
  async getImage(id) {
    const r = await api(`/images/${id}`);
    if (!r.ok) return undefined;
    return r.blob();
  },
  async deleteProject(id) {
    await api(`/projects/${id}`, { method: "DELETE" });
  },
  async copyImage(fromId, toId) {
    const blob = await this.getImage(fromId);
    if (blob) await this.putImage(toId, blob);
  },
  async imageUrls(ids) {
    // Photos are served directly by the API (no blob download); the auth cookie rides along.
    const urls = new Map<string, string>();
    for (const id of ids) urls.set(id, `${API_BASE}/images/${id}`);
    return urls;
  },
  async authStatus() {
    try {
      const r = await api("/auth/status");
      if (r.ok) return (await r.json()) as AuthStatus;
    } catch {
      /* fall through */
    }
    return { needsSetup: false, authed: false };
  },
  async me() {
    try {
      const r = await api("/auth/me");
      return r.ok ? ((await r.json()) as User) : null;
    } catch {
      return null;
    }
  },
  async setup(username, password) {
    return postResult("/auth/setup", { username, password });
  },
  async login(username, password) {
    return postResult("/auth/login", { username, password });
  },
  async logout() {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
  },
  async listUsers() {
    try {
      const r = await api("/users");
      return r.ok ? ((await r.json()) as User[]) : [];
    } catch {
      return [];
    }
  },
  async createUser(username, password) {
    return postResult("/users", { username, password });
  },
  async deleteUser(id) {
    try {
      const r = await api(`/users/${id}`, { method: "DELETE" });
      if (r.ok) return { ok: true };
      const b = (await r.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: b.error };
    } catch {
      return { ok: false, error: "network error" };
    }
  },
  async changePassword(currentPassword, newPassword) {
    return postResult("/account/password", { currentPassword, newPassword });
  },
  async version(force) {
    try {
      const r = await api(force ? "/version?refresh=1" : "/version");
      if (r.ok) return (await r.json()) as VersionInfo;
    } catch {
      /* fall through */
    }
    return { current: __APP_VERSION__, latest: null, updateAvailable: false, canApply: false };
  },
  async applyUpdate() {
    try {
      const r = await api("/update", { method: "POST" });
      if (r.ok) return { started: true };
      const body = (await r.json().catch(() => ({}))) as { inProgress?: boolean; error?: string; manualCommand?: string };
      return { started: false, inProgress: body.inProgress, error: body.error, manualCommand: body.manualCommand };
    } catch {
      return { started: false };
    }
  },
};

/**
 * Pick the backend: the server when its /api/health returns the expected JSON, else IndexedDB
 * (local-first). The body check matters: a static host (nginx SPA fallback, `vite preview`)
 * answers /api/health with index.html and a 200, so requiring `status: "ok"` avoids a false
 * "remote" in dev / static-only deployments.
 */
export async function initBackend(): Promise<PersistenceBackend> {
  try {
    const r = await fetch(`${API_BASE}/health`, { method: "GET" });
    if (r.ok) {
      const body = (await r.json()) as { status?: string };
      if (body?.status === "ok") return remoteBackend;
    }
  } catch {
    /* no server (or a non-JSON SPA fallback): fall back to local */
  }
  return makeLocalBackend(await isAvailable());
}
