import { describe, it, expect } from "vitest";
import { computeLayout, type LayoutItem } from "./layout";

const item = (ratio: number): LayoutItem => ({ ratio });

// The single invariant that matters most: a photo's aspect ratio is never
// altered. Everything else (size, gap, whitespace) is negotiable; the ratio
// is not. These tests exist to catch any regression that would sneak a crop in.
function ratioOf(w: number, h: number) {
  return w / h;
}

describe("computeLayout", () => {
  it("returns nothing for an empty page or a zero-sized box", () => {
    expect(computeLayout([], 500, 500, { density: 50 }).rows).toHaveLength(0);
    expect(computeLayout([item(1.5)], 0, 500, { density: 50 }).rows).toHaveLength(0);
  });

  it("preserves each photo's aspect ratio exactly (no crop, no distortion)", () => {
    const ratios = [2 / 3, 3 / 2, 1, 16 / 9, 4 / 5];
    const res = computeLayout(ratios.map(item), 600, 600, { density: 50 });
    const seen = res.rows.flatMap((r) => r.cells);
    expect(seen).toHaveLength(ratios.length);
    for (const cell of seen) {
      expect(ratioOf(cell.w, cell.h)).toBeCloseTo(cell.item.ratio, 6);
    }
  });

  it("never lets a row overflow the content width", () => {
    const res = computeLayout(
      Array.from({ length: 6 }, () => item(3 / 2)),
      600,
      600,
      { density: 90 },
    );
    for (const row of res.rows) {
      const rowW =
        row.cells.reduce((a, c) => a + c.w, 0) + res.gap * (row.cells.length - 1);
      expect(rowW).toBeLessThanOrEqual(600 + 0.5);
    }
  });

  it("never lets the stacked block overflow the content height", () => {
    const res = computeLayout(
      Array.from({ length: 8 }, () => item(1)),
      500,
      500,
      { density: 100 },
    );
    const blockH =
      res.rows.length * (res.rows[0]?.cells[0]?.h ?? 0) +
      res.gap * (res.rows.length - 1);
    expect(blockH).toBeLessThanOrEqual(500 + 0.5);
  });

  it("gives less whitespace (bigger photos) at higher density", () => {
    const airy = computeLayout([item(1)], 600, 600, { density: 20 });
    const dense = computeLayout([item(1)], 600, 600, { density: 80 });
    expect(dense.rows[0].cells[0].h).toBeGreaterThan(airy.rows[0].cells[0].h);
  });

  it("keeps a very wide panorama inside the page by scaling, not cropping", () => {
    const pano = item(16 / 7);
    const res = computeLayout([pano], 600, 600, { density: 100 });
    const cell = res.rows[0].cells[0];
    expect(cell.w).toBeLessThanOrEqual(600 + 0.5);
    expect(ratioOf(cell.w, cell.h)).toBeCloseTo(16 / 7, 6);
  });
});
