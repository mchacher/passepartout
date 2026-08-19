// Pure helpers for editing a page's grid placement (spec 013 Phase B). No React, no DOM:
// the editor turns pointer gestures into new CellRects, snapped to the fixed grid and kept
// inside it. Only a cell's position and span change; the photo is contain-fit inside it by
// the engine, so nothing is ever cropped.

import type { CellRect } from "../types";
import { GRID_COLS, GRID_ROWS } from "./layouts";

const clampInt = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * New photo anchor (0..1) after dragging by `dPx` within a cell whose free space on that
 * axis is `freePx` (region size minus the contain-fit photo size). The photo follows the
 * cursor; when there is no free space (the photo fills that axis) the anchor cannot move.
 */
export function panAnchor(startA: number, dPx: number, freePx: number): number {
  if (freePx <= 0) return clamp01(startA);
  return clamp01(startA + dPx / freePx);
}

/** Translate a cell by whole grid units, clamped so it stays fully inside the grid. */
export function moveCell(rect: CellRect, dCol: number, dRow: number): CellRect {
  const col = clampInt(rect.col + dCol, 0, GRID_COLS - rect.colSpan);
  const row = clampInt(rect.row + dRow, 0, GRID_ROWS - rect.rowSpan);
  return { ...rect, col, row };
}

/** Which corner is being dragged. */
export type Corner = "tl" | "tr" | "bl" | "br";

/**
 * Resize a cell by dragging one corner by whole grid units. The opposite corner is fixed;
 * spans stay >= 1 and the cell stays inside the grid. Top/left drags move the origin.
 */
export function resizeCell(rect: CellRect, corner: Corner, dCol: number, dRow: number): CellRect {
  const left = rect.col;
  const top = rect.row;
  const right = rect.col + rect.colSpan;
  const bottom = rect.row + rect.rowSpan;

  let nl = left;
  let nt = top;
  let nr = right;
  let nb = bottom;

  if (corner === "tl" || corner === "bl") nl = clampInt(left + dCol, 0, right - 1);
  if (corner === "tr" || corner === "br") nr = clampInt(right + dCol, left + 1, GRID_COLS);
  if (corner === "tl" || corner === "tr") nt = clampInt(top + dRow, 0, bottom - 1);
  if (corner === "bl" || corner === "br") nb = clampInt(bottom + dRow, top + 1, GRID_ROWS);

  return { ...rect, col: nl, row: nt, colSpan: nr - nl, rowSpan: nb - nt };
}

/**
 * Return `cells` with the cell at `index` restacked: `front` gives it a `z` above every
 * other cell, `back` below every other. Effective `z` defaults to the array index.
 */
export function restack(cells: CellRect[], index: number, where: "front" | "back"): CellRect[] {
  if (index < 0 || index >= cells.length) return cells;
  const zs = cells.map((c, i) => c.z ?? i);
  const others = zs.filter((_, i) => i !== index);
  if (others.length === 0) return cells;
  const z = where === "front" ? Math.max(...others) + 1 : Math.min(...others) - 1;
  return cells.map((c, i) => (i === index ? { ...c, z } : c));
}
