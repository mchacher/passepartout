// Undo history (spec 037), pure. A bounded stack of album snapshots, with coalescing so a
// burst of small edits (typing a title, dragging a slider) reads as ONE step.
//
// The stack holds whole snapshots rather than inverse operations. An album document is small
// (metadata and ids; photo bytes live in storage, never here), and a snapshot cannot drift out
// of sync with the action that produced it, which an inverse operation can.
//
// No React, no store, no DOM: this module only shapes a list.

export interface HistoryEntry<T> {
  /** The album as it was BEFORE the edit this entry can take back. */
  snapshot: T;
  /**
   * What this step merges with. Two consecutive pushes carrying the same key are one step:
   * typing keeps replacing the same title, so undo should restore the title as it was before
   * the FIRST keystroke, not before the last one. A missing key never merges.
   */
  coalesceKey?: string;
  /** When the entry last absorbed an edit, so a pause can break the run. */
  at?: number;
}

/**
 * How long a run of edits to one field keeps absorbing more. Coming back to the same title
 * after a pause is a new intention, and should cost its own undo (spec 037 R2).
 */
export const COALESCE_WINDOW_MS = 1000;

export interface PushOptions {
  /** Maximum steps kept; the oldest are dropped past it. */
  limit: number;
  /** The key of the step being pushed, if it may merge with the one before it. */
  coalesceKey?: string;
  /** Now, in ms. Two edits further apart than the window never merge. */
  now?: number;
}

/**
 * Push a snapshot, returning a NEW stack (the old one is never mutated).
 *
 * When the incoming key matches the top of the stack, nothing is pushed: the entry already
 * there holds the older snapshot, which is the one undo has to restore.
 */
export function pushHistory<T>(
  stack: readonly HistoryEntry<T>[],
  snapshot: T,
  { limit, coalesceKey, now }: PushOptions,
): HistoryEntry<T>[] {
  const top = stack[stack.length - 1];
  const fresh = now === undefined || top?.at === undefined || now - top.at <= COALESCE_WINDOW_MS;
  if (coalesceKey !== undefined && top?.coalesceKey === coalesceKey && fresh) {
    // Merged into the step already recorded, which holds the older snapshot undo needs. Only
    // the timestamp moves, so a run of edits keeps the window open as long as it keeps going.
    return [...stack.slice(0, -1), { ...top, at: now }];
  }
  const next = [...stack, { snapshot, coalesceKey, at: now }];
  return next.length > limit ? next.slice(next.length - limit) : next;
}

/** The top entry and the stack without it, or null when there is nothing to take back. */
export function popHistory<T>(
  stack: readonly HistoryEntry<T>[],
): { entry: HistoryEntry<T>; rest: HistoryEntry<T>[] } | null {
  if (stack.length === 0) return null;
  return { entry: stack[stack.length - 1], rest: stack.slice(0, -1) };
}
