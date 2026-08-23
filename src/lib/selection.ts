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

// The outline a cell wears in "Edit layout" (issue 85). Every selected cell, primary or not,
// gets the exact same ring: three shades of one accent read as three states and made a
// multi-selection unreadable. An unselected cell gets a neutral ring that cannot be mistaken
// for a selected one, thickening on hover to stay obviously clickable. The primary is told
// apart by its resize handles, which are what actually belongs to it.
export const SELECTED_OUTLINE = "ring-2 ring-accent";
export const UNSELECTED_OUTLINE = "ring-1 ring-line-strong hover:ring-2";

export function outlineFor(primary: boolean, inSelection: boolean): string {
  return primary || inSelection ? SELECTED_OUTLINE : UNSELECTED_OUTLINE;
}
