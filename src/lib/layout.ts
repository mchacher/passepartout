// The layout engine.
//
// Contract: given a set of photos (by aspect ratio only), the printable area of a
// page, and an explicit layout template, place each photo inside a fixed region of
// the page. A photo is contain-fit and centered inside its region, keeping its
// native ratio, surrounded by generous whitespace ("blancs assumes"). The only
// degrees of freedom are size and gap. There is deliberately NO crop parameter: a
// photo is never resized non-proportionally and never clipped.
//
// The region structure comes entirely from the template and is INDEPENDENT of
// density. Density (the whitespace slider) only scales how much of its region each
// photo occupies. So dragging the slider makes photos breathe; it never re-groups
// them - that is the whole point of explicit layouts.
//
// This module is pure and framework-agnostic so it can be unit tested and, later,
// reused to paint a print-resolution PDF page from the same numbers.

import { WHITESPACE_LEVELS } from "../types";
import type { LayoutNode } from "./layouts";

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
 * Walk the template tree over `box`, collecting one region rect per leaf in order.
 * Siblings are separated by a fixed structural `gap` and sized by optional weights
 * (equal when omitted). The structure does not depend on density.
 */
function collectRegions(node: LayoutNode, box: Rect, gap: number, out: Rect[]): void {
  if (node.kind === "slot") {
    out.push(box);
    return;
  }
  const n = node.children.length;
  const weights = node.weights ?? node.children.map(() => 1);
  const totalWeight = weights.reduce((a, w) => a + w, 0);
  const along = node.axis === "h" ? box.w : box.h;
  const free = Math.max(0, along - gap * (n - 1));

  let offset = node.axis === "h" ? box.x : box.y;
  for (let i = 0; i < n; i++) {
    const size = free * (weights[i] / totalWeight);
    const childBox: Rect =
      node.axis === "h"
        ? { x: offset, y: box.y, w: size, h: box.h }
        : { x: box.x, y: offset, w: box.w, h: size };
    collectRegions(node.children[i], childBox, gap, out);
    offset += size + gap;
  }
}

/**
 * Arrange `items` inside a `contentW` x `contentH` content box following `node`.
 * Each item gets a fixed region; its photo box is contain-fit inside the region,
 * scaled by a density-driven fill fraction, and centered. Nothing overflows.
 */
export function computeLayout<T extends LayoutItem>(
  items: T[],
  contentW: number,
  contentH: number,
  node: LayoutNode,
  opts: LayoutOptions,
): LayoutResult<T> {
  if (items.length === 0 || contentW <= 0 || contentH <= 0) {
    return { cells: [] };
  }

  const density = clamp(opts.density, 0, 100);
  // Fill fraction: how much of its region the photo occupies. Higher density = more
  // fill (less white). At the top end the photo fills its region's constraining
  // dimension (fill = 1); it is never scaled above the contain fit, so the ratio is
  // kept and the fixed gap between regions is the guaranteed minimum whitespace.
  const fill = 0.5 + 0.5 * (density / 100);
  // A small, density-independent gap between sibling regions keeps the structure airy.
  const gap = Math.max(6, Math.min(contentW, contentH) * 0.03);

  const regions: Rect[] = [];
  collectRegions(node, { x: 0, y: 0, w: contentW, h: contentH }, gap, regions);

  const cells: PlacedCell<T>[] = [];
  const n = Math.min(items.length, regions.length);
  for (let i = 0; i < n; i++) {
    const item = items[i];
    const r = regions[i];
    // Contain-fit the ratio inside the region, then scale by the fill fraction.
    const boxH = Math.min(r.h, r.w / item.ratio) * fill;
    const boxW = boxH * item.ratio;
    cells.push({ item, rx: r.x, ry: r.y, rw: r.w, rh: r.h, w: boxW, h: boxH });
  }

  return { cells };
}
