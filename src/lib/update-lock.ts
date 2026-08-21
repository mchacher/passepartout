// The non-interruptible update lock (spec 031), persisted so a page refresh keeps the screen
// locked while the server recreates its containers. Kept as a small pure module so the storage
// format and the timeout decision are unit-testable without the store.

export interface UpdateLock {
  target: string; // the version we expect to see once the update lands
  startedAt: number; // epoch ms; used for the safety timeout
  failed?: boolean; // the timeout elapsed without the new version coming up
}

export const UPDATE_LOCK_KEY = "pp.updating";
export const UPDATE_TIMEOUT_MS = 4 * 60 * 1000; // give up locking after this; offer a manual reload
export const UPDATE_POLL_MS = 3000;

export function readUpdateLock(): UpdateLock | null {
  try {
    const raw = localStorage.getItem(UPDATE_LOCK_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as UpdateLock;
    return typeof v?.target === "string" && typeof v?.startedAt === "number" ? v : null;
  } catch {
    return null;
  }
}

export function writeUpdateLock(lock: UpdateLock): void {
  try {
    localStorage.setItem(UPDATE_LOCK_KEY, JSON.stringify(lock));
  } catch {
    /* the in-memory lock still guards this tab */
  }
}

export function clearUpdateLock(): void {
  try {
    localStorage.removeItem(UPDATE_LOCK_KEY);
  } catch {
    /* ignore */
  }
}

/** A lock still worth showing: set, not failed, and within the safety window. */
export function isLockActive(lock: UpdateLock | null, now: number): lock is UpdateLock {
  return !!lock && !lock.failed && now - lock.startedAt < UPDATE_TIMEOUT_MS;
}
