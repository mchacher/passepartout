import { describe, it, expect } from "vitest";
import {
  CATALOG,
  GRID_COLS,
  GRID_ROWS,
  autoCells,
  defaultLayoutId,
  getLayout,
  layoutsForCount,
  resolveCells,
  slotCount,
} from "./layouts";
import type { CellRect } from "../types";

// Mark every grid unit a set of cells covers; returns false if any two cells overlap.
function noOverlap(cells: CellRect[]): boolean {
  const seen = new Set<string>();
  for (const c of cells) {
    for (let x = c.col; x < c.col + c.colSpan; x++) {
      for (let y = c.row; y < c.row + c.rowSpan; y++) {
        const key = `${x},${y}`;
        if (seen.has(key)) return false;
        seen.add(key);
      }
    }
  }
  return true;
}

const withinGrid = (c: CellRect) =>
  c.col >= 0 &&
  c.row >= 0 &&
  c.colSpan > 0 &&
  c.rowSpan > 0 &&
  c.col + c.colSpan <= GRID_COLS &&
  c.row + c.rowSpan <= GRID_ROWS;

describe("layout catalog (grid)", () => {
  it("every template has as many cells as its declared count", () => {
    for (const tpl of CATALOG) {
      expect(tpl.cells).toHaveLength(tpl.count);
    }
  });

  it("every template's cells stay inside the 12 x 12 grid", () => {
    for (const tpl of CATALOG) {
      for (const c of tpl.cells) {
        expect(withinGrid(c), `${tpl.id} has an out-of-bounds cell`).toBe(true);
      }
    }
  });

  it("no template overlaps its own cells", () => {
    for (const tpl of CATALOG) {
      expect(noOverlap(tpl.cells), `${tpl.id} overlaps`).toBe(true);
    }
  });

  it("has unique ids", () => {
    const ids = CATALOG.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("offers at least one template for each count 1..6", () => {
    for (let n = 1; n <= 6; n++) {
      expect(layoutsForCount(n).length).toBeGreaterThan(0);
    }
  });

  it("defaultLayoutId(n) returns a template of that count for 1..6", () => {
    for (let n = 1; n <= 6; n++) {
      expect(getLayout(defaultLayoutId(n))?.count).toBe(n);
    }
  });

  it("defaultLayoutId falls back to 'auto' outside 1..6", () => {
    expect(defaultLayoutId(0)).toBe("auto");
    expect(defaultLayoutId(7)).toBe("auto");
    expect(getLayout("auto")).toBeUndefined();
  });
});

describe("autoCells", () => {
  it("produces exactly n cells (min 1), in bounds and non-overlapping", () => {
    for (const n of [1, 2, 3, 5, 7, 9, 40, 100]) {
      const cells = autoCells(n);
      expect(cells).toHaveLength(n <= 1 ? 1 : n);
      for (const c of cells) expect(withinGrid(c)).toBe(true);
      expect(noOverlap(cells)).toBe(true);
    }
  });

  it("autoCells(1) is a single full-grid cell", () => {
    expect(autoCells(1)).toEqual([{ col: 0, row: 0, colSpan: GRID_COLS, rowSpan: GRID_ROWS }]);
  });
});

describe("resolveCells", () => {
  const custom: CellRect[] = [
    { col: 0, row: 0, colSpan: 8, rowSpan: 12 },
    { col: 8, row: 0, colSpan: 4, rowSpan: 12 },
  ];

  it("prefers a valid custom placement over the template", () => {
    expect(resolveCells("two-row", 2, custom)).toBe(custom);
  });

  it("ignores a placement whose length does not match the count", () => {
    expect(resolveCells("two-row", 2, [custom[0]])).toEqual(getLayout("two-row")!.cells);
  });

  it("uses the named template when it matches the count", () => {
    expect(resolveCells("grid-2x2", 4)).toEqual(getLayout("grid-2x2")!.cells);
  });

  it("falls back to autoCells for an unknown id or a count mismatch", () => {
    expect(resolveCells("nope", 3)).toEqual(autoCells(3));
    expect(resolveCells("grid-2x2", 5)).toEqual(autoCells(5)); // template is count 4
  });
});

describe("slotCount (spec 035)", () => {
  it("uses the named template's leaf count, not the photo count", () => {
    expect(slotCount("three-row", 1)).toBe(3); // 3-slot layout holding 1 photo
    expect(slotCount("single", 0)).toBe(1); // an empty page still has one slot
    expect(slotCount("six-3x2", 2)).toBe(6);
  });

  it("uses the custom placement length when there is no template match", () => {
    const placement: CellRect[] = [
      { col: 0, row: 0, colSpan: 8, rowSpan: 12 },
      { col: 8, row: 0, colSpan: 4, rowSpan: 12 },
    ];
    expect(slotCount("auto", 1, placement)).toBe(2);
  });

  it("falls back to the photo count beyond the catalog (auto, always full)", () => {
    expect(slotCount("auto", 9)).toBe(9);
    expect(slotCount("unknown-id", 4)).toBe(4);
  });
});
