import { describe, it, expect } from "vitest";
import {
  computeLayout,
  whitespaceToDensity,
  type LayoutItem,
  type PlacedCell,
} from "./layout";
import { autoCells, getLayout } from "./layouts";
import { WHITESPACE_LEVELS, type CellRect } from "../types";

const item = (ratio: number): LayoutItem => ({ ratio });
const cellsOf = (id: string): CellRect[] => getLayout(id)!.cells;

// The single invariant that matters most: a photo's aspect ratio is never altered.
// Everything else (size, gap, whitespace) is negotiable; the ratio is not. These
// tests exist to catch any regression that would sneak a crop in.
function ratioOf(w: number, h: number) {
  return w / h;
}

const EPS = 0.5;

describe("computeLayout", () => {
  it("returns nothing for an empty page or a zero-sized box", () => {
    expect(computeLayout([], 500, 500, cellsOf("single"), { density: 50 }).cells).toHaveLength(0);
    expect(
      computeLayout([item(1.5)], 0, 500, cellsOf("single"), { density: 50 }).cells,
    ).toHaveLength(0);
  });

  it("preserves each photo's aspect ratio exactly (no crop, no distortion)", () => {
    const ratios = [2 / 3, 3 / 2, 1, 16 / 9];
    const cells = computeLayout(ratios.map(item), 600, 600, cellsOf("grid-2x2"), {
      density: 50,
    }).cells;
    expect(cells).toHaveLength(ratios.length);
    for (const cell of cells) {
      expect(ratioOf(cell.w, cell.h)).toBeCloseTo(cell.item.ratio, 6);
    }
  });

  it("preserves ratios across every catalog template and density", () => {
    const ratios = [3 / 2, 2 / 3, 1, 16 / 9];
    for (const tpl of ["single", "two-row", "one-beside-two", "grid-2x2", "one-over-three"]) {
      const count = getLayout(tpl)!.count;
      const items = ratios.slice(0, count).map(item);
      for (const density of [0, 50, 100]) {
        const cells = computeLayout(items, 640, 480, cellsOf(tpl), { density }).cells;
        for (const cell of cells) {
          expect(ratioOf(cell.w, cell.h)).toBeCloseTo(cell.item.ratio, 6);
        }
      }
    }
  });

  it("keeps every photo box inside its region (no overflow, no clip)", () => {
    const cells = computeLayout(
      [item(16 / 9), item(2 / 3), item(1), item(3 / 2)],
      600,
      600,
      cellsOf("grid-2x2"),
      { density: 100 },
    ).cells;
    for (const cell of cells) {
      expect(cell.w).toBeLessThanOrEqual(cell.rw + EPS);
      expect(cell.h).toBeLessThanOrEqual(cell.rh + EPS);
    }
  });

  it("keeps every region inside the content box", () => {
    const cells = computeLayout(
      [item(1), item(1), item(1), item(1)],
      500,
      700,
      cellsOf("one-over-three"),
      { density: 60 },
    ).cells;
    for (const c of cells) {
      expect(c.rx).toBeGreaterThanOrEqual(-EPS);
      expect(c.ry).toBeGreaterThanOrEqual(-EPS);
      expect(c.rx + c.rw).toBeLessThanOrEqual(500 + EPS);
      expect(c.ry + c.rh).toBeLessThanOrEqual(700 + EPS);
    }
  });

  it("keeps a very wide panorama contained inside its slot by scaling, not cropping", () => {
    const cells = computeLayout([item(16 / 7)], 600, 600, cellsOf("single"), {
      density: 100,
    }).cells;
    const cell = cells[0];
    expect(cell.w).toBeLessThanOrEqual(cell.rw + EPS);
    expect(cell.h).toBeLessThanOrEqual(cell.rh + EPS);
    expect(ratioOf(cell.w, cell.h)).toBeCloseTo(16 / 7, 6);
  });

  it("gives bigger photos at higher density, same template", () => {
    const airy = computeLayout([item(1)], 600, 600, cellsOf("single"), { density: 20 });
    const dense = computeLayout([item(1)], 600, 600, cellsOf("single"), { density: 80 });
    expect(dense.cells[0].h).toBeGreaterThan(airy.cells[0].h);
  });

  it("fills the region at the tightest level and keeps a raised floor at the airiest (spec 010)", () => {
    // Single slot on a square box: the region is the whole content box (600x600), so a
    // square photo's contain-fit height is 600. Fill is 1.0 at density 100 and 0.6 at 0.
    const tight = computeLayout([item(1)], 600, 600, cellsOf("single"), { density: 100 }).cells[0];
    const airy = computeLayout([item(1)], 600, 600, cellsOf("single"), { density: 0 }).cells[0];
    expect(tight.h).toBeCloseTo(600, 4); // fill 1.0 -> maximized, ratio intact
    expect(tight.w / tight.h).toBeCloseTo(1, 6);
    expect(airy.h).toBeCloseTo(360, 1); // fill 0.6 (was 300 at the old 0.5 floor)
  });

  it("uses a tighter inter-region gap than the old 3% formula", () => {
    // grid-2x2 on a 600x600 box: cells 0 and 1 share a row (see the grid test below),
    // so the horizontal space between them is the structural gap, now ~2% of the box.
    const cells = computeLayout(
      [item(1), item(1), item(1), item(1)],
      600,
      600,
      cellsOf("grid-2x2"),
      { density: 50 },
    ).cells;
    const gap = cells[1].rx - (cells[0].rx + cells[0].rw);
    expect(gap).toBeGreaterThan(0); // regions never overlap
    expect(gap).toBeLessThan(600 * 0.03); // tighter than the previous 3% gap
    expect(gap).toBeCloseTo(600 * 0.02, 1);
  });

  it("leaves the region structure identical across densities (layout is frozen)", () => {
    const items = [item(3 / 2), item(2 / 3), item(1)];
    const lo = computeLayout(items, 600, 600, cellsOf("one-beside-two"), { density: 10 }).cells;
    const hi = computeLayout(items, 600, 600, cellsOf("one-beside-two"), { density: 90 }).cells;
    for (let i = 0; i < lo.length; i++) {
      expect(hi[i].rx).toBeCloseTo(lo[i].rx, 6);
      expect(hi[i].ry).toBeCloseTo(lo[i].ry, 6);
      expect(hi[i].rw).toBeCloseTo(lo[i].rw, 6);
      expect(hi[i].rh).toBeCloseTo(lo[i].rh, 6);
    }
  });

  it("lays grid-2x2 into two rows and two columns", () => {
    const cells = computeLayout(
      [item(1), item(1), item(1), item(1)],
      600,
      600,
      cellsOf("grid-2x2"),
      { density: 50 },
    ).cells;
    const cx = (c: PlacedCell<LayoutItem>) => c.rx + c.rw / 2;
    const cy = (c: PlacedCell<LayoutItem>) => c.ry + c.rh / 2;
    // Two distinct column centers and two distinct row centers.
    expect(cx(cells[0])).toBeLessThan(cx(cells[1]));
    expect(cx(cells[2])).toBeLessThan(cx(cells[3]));
    expect(cy(cells[0])).toBeLessThan(cy(cells[2]));
    expect(cy(cells[1])).toBeLessThan(cy(cells[3]));
  });

  it("makes the hero region wider in one-beside-two", () => {
    const cells = computeLayout(
      [item(1), item(1), item(1)],
      600,
      600,
      cellsOf("one-beside-two"),
      { density: 50 },
    ).cells;
    // Left hero region is wider than each right-hand region.
    expect(cells[0].rw).toBeGreaterThan(cells[1].rw);
    expect(cells[0].rw).toBeGreaterThan(cells[2].rw);
  });

  it("makes a single full-grid cell fill the whole content box", () => {
    const c = computeLayout([item(1)], 640, 480, cellsOf("single"), { density: 50 }).cells[0];
    expect(c.rx).toBeCloseTo(0, 6);
    expect(c.ry).toBeCloseTo(0, 6);
    expect(c.rw).toBeCloseTo(640, 4); // internal gutters are absorbed into the spanning cell
    expect(c.rh).toBeCloseTo(480, 4);
  });
});

describe("whitespaceToDensity", () => {
  it("maps level 1 to full density and the top level to zero", () => {
    expect(whitespaceToDensity(1)).toBe(100);
    expect(whitespaceToDensity(WHITESPACE_LEVELS)).toBe(0);
  });

  it("decreases monotonically as the whitespace level rises", () => {
    for (let n = 2; n <= WHITESPACE_LEVELS; n++) {
      expect(whitespaceToDensity(n)).toBeLessThan(whitespaceToDensity(n - 1));
    }
  });

  it("clamps out-of-range levels", () => {
    expect(whitespaceToDensity(0)).toBe(100);
    expect(whitespaceToDensity(99)).toBe(0);
  });

  it("makes bigger photos at a lower whitespace level (via the engine)", () => {
    const item = (ratio: number): LayoutItem => ({ ratio });
    const airy = computeLayout([item(1)], 600, 600, cellsOf("single"), {
      density: whitespaceToDensity(8),
    });
    const full = computeLayout([item(1)], 600, 600, cellsOf("single"), {
      density: whitespaceToDensity(1),
    });
    expect(full.cells[0].h).toBeGreaterThan(airy.cells[0].h);
  });
});

describe("autoCells fallback", () => {
  it("places any count of items when there is no catalog entry", () => {
    for (const count of [5, 7]) {
      const items = Array.from({ length: count }, () => item(1));
      const cells = computeLayout(items, 800, 600, autoCells(count), {
        density: 60,
      }).cells;
      expect(cells).toHaveLength(count);
      for (const c of cells) {
        expect(c.w).toBeLessThanOrEqual(c.rw + EPS);
        expect(c.h).toBeLessThanOrEqual(c.rh + EPS);
      }
    }
  });
});
