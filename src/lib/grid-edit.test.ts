import { describe, it, expect } from "vitest";
import { moveCell, resizeCell, restack, panAnchor } from "./grid-edit";
import type { CellRect } from "../types";

const cell = (col: number, row: number, colSpan: number, rowSpan: number): CellRect => ({
  col,
  row,
  colSpan,
  rowSpan,
});

describe("moveCell", () => {
  it("translates a cell by whole units", () => {
    expect(moveCell(cell(2, 2, 4, 4), 3, -1)).toMatchObject({ col: 5, row: 1, colSpan: 4, rowSpan: 4 });
  });

  it("clamps so the cell stays inside the grid", () => {
    expect(moveCell(cell(8, 8, 4, 4), 5, 5)).toMatchObject({ col: 8, row: 8 }); // max col/row = 12-4
    expect(moveCell(cell(2, 2, 4, 4), -10, -10)).toMatchObject({ col: 0, row: 0 });
  });
});

describe("resizeCell", () => {
  it("grows from the bottom-right corner, origin fixed", () => {
    const r = resizeCell(cell(0, 0, 4, 4), "br", 2, 3);
    expect(r).toMatchObject({ col: 0, row: 0, colSpan: 6, rowSpan: 7 });
  });

  it("moves the origin when dragging the top-left corner", () => {
    const r = resizeCell(cell(4, 4, 4, 4), "tl", -2, -1);
    expect(r).toMatchObject({ col: 2, row: 3, colSpan: 6, rowSpan: 5 });
  });

  it("never shrinks a span below 1", () => {
    const r = resizeCell(cell(2, 2, 3, 3), "br", -10, -10);
    expect(r.colSpan).toBe(1);
    expect(r.rowSpan).toBe(1);
    expect(r.col).toBe(2);
    expect(r.row).toBe(2);
  });

  it("keeps the cell inside the grid when growing past an edge", () => {
    const r = resizeCell(cell(9, 9, 3, 3), "br", 10, 10);
    expect(r.col + r.colSpan).toBeLessThanOrEqual(12);
    expect(r.row + r.rowSpan).toBeLessThanOrEqual(12);
  });
});

describe("restack", () => {
  const cells = [cell(0, 0, 6, 6), cell(3, 3, 6, 6), cell(6, 6, 6, 6)];

  it("brings a cell in front of all others", () => {
    const out = restack(cells, 0, "front");
    const z0 = out[0].z!;
    expect(z0).toBeGreaterThan(out[1].z ?? 1);
    expect(z0).toBeGreaterThan(out[2].z ?? 2);
  });

  it("sends a cell behind all others", () => {
    const out = restack(cells, 2, "back");
    const z2 = out[2].z!;
    expect(z2).toBeLessThan(out[0].z ?? 0);
    expect(z2).toBeLessThan(out[1].z ?? 1);
  });

  it("is a no-op for an out-of-range index", () => {
    expect(restack(cells, 9, "front")).toBe(cells);
  });
});

describe("panAnchor", () => {
  it("moves the anchor with the drag, scaled by the free space", () => {
    expect(panAnchor(0.5, 40, 200)).toBeCloseTo(0.7, 6); // +40/200 = +0.2
    expect(panAnchor(0.5, -100, 200)).toBeCloseTo(0, 6); // -0.5, clamped to 0
  });

  it("clamps to [0,1]", () => {
    expect(panAnchor(0.9, 500, 200)).toBe(1);
    expect(panAnchor(0.1, -500, 200)).toBe(0);
  });

  it("cannot move when the axis has no free space", () => {
    expect(panAnchor(0.3, 100, 0)).toBe(0.3);
  });
});
