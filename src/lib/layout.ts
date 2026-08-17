// The layout engine.
//
// Contract: given a set of photos (by aspect ratio only) and the printable area
// of a page, arrange them into centered rows that keep every photo's native
// ratio and leave generous, symmetric whitespace ("blancs assumes"). The only
// degrees of freedom are size and gap. There is deliberately NO crop parameter:
// a photo is never resized non-proportionally and never clipped.
//
// This module is pure and framework-agnostic so it can be unit tested and,
// later, reused to paint a print-resolution PDF page from the same numbers.

export interface LayoutItem {
  ratio: number; // width / height
}

export interface PlacedCell<T extends LayoutItem> {
  item: T;
  w: number; // pixels
  h: number; // pixels
}

export interface LayoutRow<T extends LayoutItem> {
  cells: PlacedCell<T>[];
}

export interface LayoutResult<T extends LayoutItem> {
  rows: LayoutRow<T>[];
  gap: number; // gap between cells and between rows, pixels
}

export interface LayoutOptions {
  /** 0 = maximum whitespace (small photos), 100 = minimal whitespace. */
  density: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Arrange items in a content box of `contentW` x `contentH` pixels.
 * Rows are packed greedily by width, then the whole block is scaled down to fit
 * so nothing overflows the page. Rows are centered, not justified to full width,
 * which is what produces the airy, gallery look.
 */
export function computeLayout<T extends LayoutItem>(
  items: T[],
  contentW: number,
  contentH: number,
  opts: LayoutOptions,
): LayoutResult<T> {
  if (items.length === 0 || contentW <= 0 || contentH <= 0) {
    return { rows: [], gap: 0 };
  }

  const density = clamp(opts.density, 0, 100);
  // Target row height as a fraction of the page height: more whitespace -> smaller.
  const targetH = contentH * (0.2 + (density / 100) * 0.62);
  // Gaps shrink as density rises (less white).
  const gap = Math.max(8, contentW * (0.015 + ((100 - density) / 100) * 0.03));

  // Greedy row packing at the target height.
  const rows: LayoutRow<T>[] = [];
  let cur: PlacedCell<T>[] = [];
  let curW = 0;
  for (const item of items) {
    const w = targetH * item.ratio;
    if (cur.length > 0 && curW + gap + w > contentW) {
      rows.push({ cells: cur });
      cur = [];
      curW = 0;
    }
    cur.push({ item, w, h: targetH });
    curW += (cur.length > 1 ? gap : 0) + w;
  }
  if (cur.length > 0) rows.push({ cells: cur });

  // Fit: scale the whole block down if the widest row overflows the width or the
  // stacked rows overflow the height. We never scale up (whitespace is a feature).
  let maxRowW = 0;
  for (const row of rows) {
    const rowW =
      row.cells.reduce((a, c) => a + c.w, 0) + gap * (row.cells.length - 1);
    if (rowW > maxRowW) maxRowW = rowW;
  }
  const blockH = rows.length * targetH + gap * (rows.length - 1);
  const scale = Math.min(
    1,
    maxRowW > 0 ? contentW / maxRowW : 1,
    blockH > 0 ? contentH / blockH : 1,
  );

  if (scale < 1) {
    for (const row of rows) {
      for (const c of row.cells) {
        c.w *= scale;
        c.h *= scale;
      }
    }
  }

  return { rows, gap: gap * scale };
}
