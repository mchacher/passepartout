// The layout catalog, on a fixed grid (spec 013).
//
// A page arrangement is an explicit, named template chosen by the user, NOT an emergent
// side effect of the whitespace slider. Each template is a list of cell rectangles on a
// fixed GRID_COLS x GRID_ROWS grid (like grid-template-areas): every rectangle holds one
// photo, in photo order. A future free-placement editor (Phase B) edits the same
// rectangles, so templates and free placement share one model.
//
// This module is pure data + pure helpers. A page persists a layout id (a named template)
// and, once detached, an explicit CellRect[] placement; the templates live here, versioned
// with the app. The engine (src/lib/layout.ts) turns cell rectangles into pixel regions
// and contain-fits each photo inside its region, so nothing is ever cropped.

import type { CellRect } from "../types";

// The fixed page grid. 12 divides by 2/3/4/6 on both axes, so the catalog reproduces
// halves, thirds, quarters and sixths exactly. Cells are non-square on non-square pages
// (a region is just a region; the photo contain-fits inside it). The gutter is a fraction
// of the content box's smaller side; only gutters between adjacent cells are visible.
export const GRID_COLS = 12;
export const GRID_ROWS = 12;
export const GRID_GUTTER_FRAC = 0.02;

export interface GridTemplate {
  id: string;
  label: string;
  count: number; // number of photo cells
  cells: CellRect[];
}

const cell = (col: number, row: number, colSpan: number, rowSpan: number): CellRect => ({
  col,
  row,
  colSpan,
  rowSpan,
});

// A horizontal band of cells with the given column spans (summing to GRID_COLS), at row
// `row` with height `rowSpan`.
function rowOf(colSpans: number[], row: number, rowSpan: number): CellRect[] {
  const cells: CellRect[] = [];
  let c = 0;
  for (const s of colSpans) {
    cells.push(cell(c, row, s, rowSpan));
    c += s;
  }
  return cells;
}

// A vertical stack of cells with the given row spans (summing to GRID_ROWS), at column
// `col` with width `colSpan`.
function colOf(rowSpans: number[], col: number, colSpan: number): CellRect[] {
  const cells: CellRect[] = [];
  let r = 0;
  for (const s of rowSpans) {
    cells.push(cell(col, r, colSpan, s));
    r += s;
  }
  return cells;
}

// Fifths do not divide 12 evenly; this symmetric split keeps a row/column of five tidy.
const FIFTHS = [3, 2, 2, 2, 3];

const FULL: CellRect[] = [cell(0, 0, GRID_COLS, GRID_ROWS)];

/**
 * The catalog. Order matters: the first template of a given count is that count's default.
 * Ids are stable (persisted on pages); the cell geometry may be refined freely.
 */
export const CATALOG: GridTemplate[] = [
  { id: "single", label: "Single", count: 1, cells: FULL },

  { id: "two-row", label: "Side by side", count: 2, cells: rowOf([6, 6], 0, 12) },
  { id: "two-col", label: "Stacked", count: 2, cells: colOf([6, 6], 0, 12) },

  { id: "three-row", label: "Row of 3", count: 3, cells: rowOf([4, 4, 4], 0, 12) },
  { id: "three-col", label: "Column of 3", count: 3, cells: colOf([4, 4, 4], 0, 12) },
  { id: "one-over-two", label: "1 over 2", count: 3, cells: [cell(0, 0, 12, 6), ...rowOf([6, 6], 6, 6)] },
  { id: "two-over-one", label: "2 over 1", count: 3, cells: [...rowOf([6, 6], 0, 6), cell(0, 6, 12, 6)] },
  { id: "one-beside-two", label: "1 beside 2", count: 3, cells: [cell(0, 0, 8, 12), ...colOf([6, 6], 8, 4)] },

  { id: "four-row", label: "Row of 4", count: 4, cells: rowOf([3, 3, 3, 3], 0, 12) },
  { id: "grid-2x2", label: "2 x 2 grid", count: 4, cells: [...rowOf([6, 6], 0, 6), ...rowOf([6, 6], 6, 6)] },
  { id: "one-over-three", label: "1 over 3", count: 4, cells: [cell(0, 0, 12, 6), ...rowOf([4, 4, 4], 6, 6)] },
  { id: "three-over-one", label: "3 over 1", count: 4, cells: [...rowOf([4, 4, 4], 0, 6), cell(0, 6, 12, 6)] },
  { id: "one-beside-three", label: "1 beside 3", count: 4, cells: [cell(0, 0, 8, 12), ...colOf([4, 4, 4], 8, 4)] },

  { id: "five-2-3", label: "2 over 3", count: 5, cells: [...rowOf([6, 6], 0, 6), ...rowOf([4, 4, 4], 6, 6)] },
  { id: "five-3-2", label: "3 over 2", count: 5, cells: [...rowOf([4, 4, 4], 0, 6), ...rowOf([6, 6], 6, 6)] },
  { id: "five-1-4", label: "1 over 4", count: 5, cells: [cell(0, 0, 12, 6), ...rowOf([3, 3, 3, 3], 6, 6)] },
  { id: "five-row", label: "Row of 5", count: 5, cells: rowOf(FIFTHS, 0, 12) },
  { id: "five-beside", label: "1 beside 4", count: 5, cells: [cell(0, 0, 8, 12), ...colOf([3, 3, 3, 3], 8, 4)] },

  { id: "six-3x2", label: "3 x 2 grid", count: 6, cells: [...rowOf([4, 4, 4], 0, 6), ...rowOf([4, 4, 4], 6, 6)] },
  {
    id: "six-2x3",
    label: "2 x 3 grid",
    count: 6,
    cells: [...rowOf([6, 6], 0, 4), ...rowOf([6, 6], 4, 4), ...rowOf([6, 6], 8, 4)],
  },
  { id: "six-2-4", label: "2 over 4", count: 6, cells: [...rowOf([6, 6], 0, 6), ...rowOf([3, 3, 3, 3], 6, 6)] },
  { id: "six-1-5", label: "1 over 5", count: 6, cells: [cell(0, 0, 12, 6), ...rowOf(FIFTHS, 6, 6)] },
  { id: "six-beside", label: "1 beside 5", count: 6, cells: [cell(0, 0, 8, 12), ...colOf(FIFTHS, 8, 4)] },
];

const BY_ID = new Map(CATALOG.map((t) => [t.id, t]));

/** All templates offered for a given photo count (empty when out of the 1-6 range). */
export function layoutsForCount(count: number): GridTemplate[] {
  return CATALOG.filter((t) => t.count === count);
}

/** Resolve a template by id, or undefined when unknown (e.g. an auto layout). */
export function getLayout(id: string): GridTemplate | undefined {
  return BY_ID.get(id);
}

/**
 * The default layout id for a photo count: the first catalog template of that count.
 * Counts outside 1-6 have no catalog entry and use an auto placement at render time, so we
 * return a synthetic "auto" id here.
 */
export function defaultLayoutId(count: number): string {
  return layoutsForCount(count)[0]?.id ?? "auto";
}

// Split `total` into `parts` integers summing to `total`, as evenly as possible (the
// remainder front-loads the first cells). Used for the balanced auto placement.
function distribute(total: number, parts: number): number[] {
  const base = Math.floor(total / parts);
  const rem = total - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i < rem ? 1 : 0));
}

/**
 * A balanced grid placement for any photo count, used when no catalog entry exists
 * (more than 6 dropped on a page by drag). Rows of up to 3, stacked; cell spans are
 * distributed as evenly as the 12-grid allows.
 */
export function autoCells(count: number): CellRect[] {
  if (count <= 1) return FULL;
  // Rows of up to 3, but never more rows than the grid has (or a huge drop of photos
  // would ask distribute() for zero-height rows and photos would vanish).
  const perRow = count <= 4 ? Math.ceil(count / 2) : Math.max(3, Math.ceil(count / GRID_ROWS));
  const rowCounts: number[] = [];
  let remaining = count;
  while (remaining > 0) {
    const n = Math.min(perRow, remaining);
    rowCounts.push(n);
    remaining -= n;
  }
  const rowSpans = distribute(GRID_ROWS, rowCounts.length);
  const cells: CellRect[] = [];
  let r = 0;
  rowCounts.forEach((n, ri) => {
    const rh = rowSpans[ri];
    let c = 0;
    for (const cw of distribute(GRID_COLS, n)) {
      cells.push(cell(c, r, cw, rh));
      c += cw;
    }
    r += rh;
  });
  return cells;
}

/**
 * The cell rectangles to render for a page: its custom `placement` when it is valid (one
 * rect per photo), else the named template when its count matches, else a balanced auto
 * placement for that count.
 */
export function resolveCells(layoutId: string, count: number, placement?: CellRect[]): CellRect[] {
  if (placement && placement.length === count && count > 0) return placement;
  const tpl = getLayout(layoutId);
  if (tpl && tpl.count === count) return tpl.cells;
  return autoCells(count);
}

/**
 * A page's SLOT COUNT (spec 035): how many cells the page is laid out for, independent of
 * how many photos are actually placed. A named template's leaf count is the capacity; a
 * detached page's capacity is its custom placement length; a page beyond the 1-6 catalog
 * (only reachable by dragging) is exactly full, so it falls back to the photo count.
 * The store keeps the invariant photoCount <= slotCount.
 */
export function slotCount(layoutId: string, photoCount: number, placement?: CellRect[]): number {
  return getLayout(layoutId)?.count ?? placement?.length ?? photoCount;
}
