// Pure helpers for the in-app book preview (spec 011). No React, no DOM: this turns a
// project's page order into the linear booklet order of leaves, pairs them into
// double-page spreads, and sizes a spread to fill the available screen while keeping the
// page aspect ratio. The faithful photo geometry inside a leaf still comes from the
// unchanged layout engine (see computeLayout), so nothing here can crop a photo.

import type { CoverFace } from "../types";

// One readable page of the book, resolved by the renderer against the store.
export type Leaf =
  | { kind: "cover"; face: CoverFace; label: string }
  | { kind: "page"; pageId: string; index: number; label: string };

// The four cover faces in booklet order and their labels.
const FRONT: Leaf = { kind: "cover", face: "front", label: "Front cover" };
const INSIDE_FRONT: Leaf = { kind: "cover", face: "insideFront", label: "Inside front" };
const INSIDE_BACK: Leaf = { kind: "cover", face: "insideBack", label: "Inside back" };
const BACK: Leaf = { kind: "cover", face: "back", label: "Back cover" };

/**
 * The whole book as a flat list of leaves in booklet order:
 * front, inside front, page 1..N, inside back, back.
 */
export function bookLeaves(pageIds: string[]): Leaf[] {
  const pages: Leaf[] = pageIds.map((pageId, i) => ({
    kind: "page",
    pageId,
    index: i,
    label: `Page ${i + 1}`,
  }));
  return [FRONT, INSIDE_FRONT, ...pages, INSIDE_BACK, BACK];
}

/**
 * Pair leaves into open-book spreads. The first leaf (the front cover) is a single recto;
 * the rest pair as (verso, recto). A trailing odd leaf (e.g. the back cover closing
 * alone) is a single spread. Every leaf appears exactly once, in order.
 */
export function toSpreads(leaves: Leaf[]): Leaf[][] {
  if (leaves.length === 0) return [];
  const spreads: Leaf[][] = [[leaves[0]]];
  for (let i = 1; i < leaves.length; i += 2) {
    spreads.push(leaves.slice(i, i + 2));
  }
  return spreads;
}

/** Index of the spread that contains the first leaf matching `pred`, or -1. */
export function spreadIndexOfLeaf(
  spreads: Leaf[][],
  pred: (leaf: Leaf) => boolean,
): number {
  return spreads.findIndex((spread) => spread.some(pred));
}

/** A short label for a spread ("Front cover", "Inside front / Page 1", "Pages 2-3"). */
export function spreadLabel(spread: Leaf[]): string {
  return spread.map((l) => l.label).join(" / ");
}

export interface PageSize {
  pageW: number;
  pageH: number;
}

/**
 * Largest page size (px) so that `n` pages of the given aspect ratio, plus a gutter of
 * `gutterFrac * pageW` between them, fit inside `avail`, maximizing the size. The page
 * ratio is preserved exactly: `pageW / pageH === aspect`. The binding constraint (width
 * or height) is met exactly, so the spread always fills the stage in one dimension and
 * never overflows the other.
 */
export function fitSpread(
  avail: { w: number; h: number },
  aspect: number,
  n: 1 | 2,
  gutterFrac: number,
): PageSize {
  if (avail.w <= 0 || avail.h <= 0 || aspect <= 0) {
    return { pageW: 0, pageH: 0 };
  }
  // Total spread width = n * pageW + (n - 1) * gutterFrac * pageW = pageW * span.
  const span = n + (n - 1) * gutterFrac;
  // Height-bound: pageH <= avail.h. Width-bound: pageW * span <= avail.w.
  const pageWFromHeight = avail.h * aspect;
  const pageWFromWidth = avail.w / span;
  const pageW = Math.min(pageWFromHeight, pageWFromWidth);
  return { pageW, pageH: pageW / aspect };
}
