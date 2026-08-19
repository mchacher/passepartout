// The layout engine.
//
// Contract: given a set of photos (by aspect ratio only), the printable area of a
// page, and a list of cell rectangles on the page grid, place each photo inside its
// cell's region. A photo is contain-fit and centered inside its region, keeping its
// native ratio, surrounded by generous whitespace ("blancs assumes"). The only
// degrees of freedom are size and gap. There is deliberately NO crop parameter: a
// photo is never resized non-proportionally and never clipped.
//
// The region structure comes entirely from the cell rectangles and is INDEPENDENT of
// density. Density (the whitespace slider) only scales how much of its region each
// photo occupies. So dragging the slider makes photos breathe; it never re-groups
// them - that is the whole point of explicit layouts.
//
// This module is pure and framework-agnostic so it can be unit tested and, later,
// reused to paint a print-resolution PDF page from the same numbers.

import { WHITESPACE_LEVELS, type CellRect } from "../types";
import { GRID_COLS, GRID_ROWS, GRID_GUTTER_FRAC } from "./layouts";

export interface LayoutItem {
  ratio: number; // width / height
}

export interface PlacedCell<T extends LayoutItem> {
  item: T;
  // The fixed region this photo lives in (template-derived, density-independent).
  rx: number;
  ry: number;
  rw: number;
  rh: number;
  // The photo box, contain-fit and scaled by density. Always w / h === item.ratio.
  w: number;
  h: number;
}

export interface LayoutResult<T extends LayoutItem> {
  cells: PlacedCell<T>[];
}

export interface LayoutOptions {
  /** 0 = maximum whitespace (small photos), 100 = minimal whitespace. */
  density: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Map a discrete whitespace level (1 .. WHITESPACE_LEVELS) to the engine's density
 * (0 .. 100). Level 1 = least whitespace (density 100, photos fill their region);
 * the top level = most whitespace (density 0). The UI picks levels; the engine and
 * the future PDF painter stay on a continuous density.
 */
export function whitespaceToDensity(level: number, levels = WHITESPACE_LEVELS): number {
  const l = clamp(level, 1, levels);
  return ((levels - l) / (levels - 1)) * 100;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Map each cell rectangle to a pixel region inside a `contentW` x `contentH` content box,
 * over the fixed GRID_COLS x GRID_ROWS grid. Tracks are equal; a gutter (a fraction of the
 * box's smaller side) sits between tracks, so only gutters between adjacent cells are
 * visible and a full-grid single cell equals the content box. Independent of density.
 */
/**
 * The order to DRAW cells in so overlapping custom placements (spec 013 Phase B) layer
 * consistently everywhere (screen, thumbnails, preview, print). Returns cell indices
 * sorted by `z ?? index`, stable for ties (earlier index stays behind). The cell <-> photo
 * mapping is by the original index, so drawing follows this order but items[i] is unchanged.
 */
export function drawOrder(cells: CellRect[]): number[] {
  return cells
    .map((c, i) => ({ i, z: c.z ?? i }))
    .sort((a, b) => a.z - b.z || a.i - b.i)
    .map((e) => e.i);
}

export function gridRegions(cells: CellRect[], contentW: number, contentH: number): Rect[] {
  const gutter = GRID_GUTTER_FRAC * Math.min(contentW, contentH);
  const trackW = (contentW - (GRID_COLS - 1) * gutter) / GRID_COLS;
  const trackH = (contentH - (GRID_ROWS - 1) * gutter) / GRID_ROWS;
  return cells.map((c) => ({
    x: c.col * (trackW + gutter),
    y: c.row * (trackH + gutter),
    w: c.colSpan * trackW + (c.colSpan - 1) * gutter,
    h: c.rowSpan * trackH + (c.rowSpan - 1) * gutter,
  }));
}

/**
 * Arrange `items` inside a `contentW` x `contentH` content box using `cells` (one grid
 * rectangle per item, in order). Each item gets a fixed region; its photo box is
 * contain-fit inside the region, scaled by a density-driven fill fraction, and centered.
 * Nothing overflows.
 */
export function computeLayout<T extends LayoutItem>(
  items: T[],
  contentW: number,
  contentH: number,
  cells: CellRect[],
  opts: LayoutOptions,
): LayoutResult<T> {
  if (items.length === 0 || contentW <= 0 || contentH <= 0) {
    return { cells: [] };
  }

  const density = clamp(opts.density, 0, 100);
  // Fill fraction: how much of its region the photo occupies. Higher density = more
  // fill (less white). At the top end the photo fills its region's constraining
  // dimension (fill = 1); it is never scaled above the contain fit, so the ratio is
  // kept and the fixed gap between regions is the guaranteed minimum whitespace. The
  // floor keeps even the airiest level from shrinking photos too far (spec 010).
  const fill = 0.6 + 0.4 * (density / 100);

  const regions = gridRegions(cells, contentW, contentH);

  const placed: PlacedCell<T>[] = [];
  const n = Math.min(items.length, regions.length);
  for (let i = 0; i < n; i++) {
    const item = items[i];
    const r = regions[i];
    // Contain-fit the ratio inside the region, then scale by the fill fraction.
    const boxH = Math.min(r.h, r.w / item.ratio) * fill;
    const boxW = boxH * item.ratio;
    placed.push({ item, rx: r.x, ry: r.y, rw: r.w, rh: r.h, w: boxW, h: boxH });
  }

  return { cells: placed };
}
