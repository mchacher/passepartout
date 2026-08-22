// Multi-photo selection on a page in "Edit layout" mode (spec 055). A plain click selects a
// single cell; Ctrl/Cmd-click toggles a cell in or out of the selection. `indices` are cell
// (slot) indices; `primary` is the last-touched cell that drives the single-photo controls
// (crop, tilt, resize, layer) and the toolbar's active state. A style (mask / frame) applies
// to every selected cell. Kept pure so the reducer is unit-tested independently of the DOM.

export interface Selection {
  indices: number[];
  primary: number | null;
}

export const EMPTY_SELECTION: Selection = { indices: [], primary: null };

// A plain click: only this cell is selected, and it becomes primary.
export function selectSingle(i: number): Selection {
  return { indices: [i], primary: i };
}

// Ctrl/Cmd-click: toggle this cell. Adding makes it primary; removing hands primary to the
// last remaining cell (or clears it when the selection empties).
export function toggleSelection(sel: Selection, i: number): Selection {
  if (sel.indices.includes(i)) {
    const indices = sel.indices.filter((x) => x !== i);
    return { indices, primary: indices.length ? indices[indices.length - 1] : null };
  }
  const indices = [...sel.indices, i];
  return { indices, primary: i };
}

// Drop any index that no longer addresses a filled cell (the photo count shrank). Primary
// survives if it still points at a live cell, otherwise falls back to the last remaining one.
export function clampSelection(sel: Selection, count: number): Selection {
  const indices = sel.indices.filter((i) => i >= 0 && i < count);
  const primary =
    sel.primary != null && indices.includes(sel.primary)
      ? sel.primary
      : indices.length
        ? indices[indices.length - 1]
        : null;
  return { indices, primary };
}
