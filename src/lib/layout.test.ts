import { describe, it, expect } from "vitest";
import {
  computeLayout,
  drawOrder,
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

  it("centers the contained photo in its region by default", () => {
    const c = computeLayout([item(2)], 600, 600, cellsOf("single"), { density: 100 }).cells[0];
    // A ratio-2 photo in a square region is full width, half height -> whitespace top/bottom.
    expect(c.ox).toBeCloseTo((c.rw - c.w) / 2, 4);
    expect(c.oy).toBeCloseTo((c.rh - c.h) / 2, 4);
  });

  it("anchors the contained photo within its cell's free space (ay), never cropping", () => {
    const cellAt = (ay: number): CellRect => ({ col: 0, row: 0, colSpan: 12, rowSpan: 12, ay });
    const top = computeLayout([item(2)], 600, 600, [cellAt(0)], { density: 100 }).cells[0];
    const bot = computeLayout([item(2)], 600, 600, [cellAt(1)], { density: 100 }).cells[0];
    expect(top.oy).toBeCloseTo(0, 4); // flush to the top
    expect(bot.oy).toBeCloseTo(bot.rh - bot.h, 4); // flush to the bottom
    // Still fully inside the region (contained, not cropped) and ratio intact.
    expect(bot.oy + bot.h).toBeLessThanOrEqual(bot.rh + 1e-6);
    expect(top.w / top.h).toBeCloseTo(2, 6);
  });

  it("makes a single full-grid cell fill the whole content box", () => {
    const c = computeLayout([item(1)], 640, 480, cellsOf("single"), { density: 50 }).cells[0];
    expect(c.rx).toBeCloseTo(0, 6);
    expect(c.ry).toBeCloseTo(0, 6);
    expect(c.rw).toBeCloseTo(640, 4); // internal gutters are absorbed into the spanning cell
    expect(c.rh).toBeCloseTo(480, 4);
  });
});

describe("drawOrder", () => {
  const c = (z?: number): CellRect => ({ col: 0, row: 0, colSpan: 1, rowSpan: 1, z });

  it("is the identity order when no cell has a z", () => {
    expect(drawOrder([c(), c(), c()])).toEqual([0, 1, 2]);
  });

  it("sorts by z, stable for ties (falls back to index)", () => {
    // z: [5, undefined(->1), 0] -> draw back-to-front: index 2 (0), index 1 (1), index 0 (5)
    expect(drawOrder([c(5), c(), c(0)])).toEqual([2, 1, 0]);
  });

  it("keeps the earlier index behind on equal z", () => {
    expect(drawOrder([c(3), c(3)])).toEqual([0, 1]);
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

  // Spec 035: a page can have more slots than placed photos. The engine must place only
  // the photos, each ratio-preserved and fitting its region; the spare regions stay empty.
  it("places only the photos when there are spare slots, ratio kept and no overflow", () => {
    const ratios = [2 / 3, 16 / 9];
    const cells3 = cellsOf("three-row"); // 3 slots
    const placed = computeLayout(ratios.map(item), 900, 600, cells3, { density: 70 }).cells;
    expect(placed).toHaveLength(ratios.length); // 2 placed, the third slot is empty
    placed.forEach((c, i) => {
      expect(ratioOf(c.w, c.h)).toBeCloseTo(ratios[i], 6); // no crop / distortion
      expect(c.w).toBeLessThanOrEqual(c.rw + EPS); // fits its region
      expect(c.h).toBeLessThanOrEqual(c.rh + EPS);
    });
  });

  it("keeps a panorama's ratio and never clips it in a spare-slot page", () => {
    const pano = item(4); // very wide
    const placed = computeLayout([pano], 400, 800, cellsOf("three-col"), { density: 100 }).cells;
    expect(placed).toHaveLength(1);
    expect(ratioOf(placed[0].w, placed[0].h)).toBeCloseTo(4, 6);
    expect(placed[0].w).toBeLessThanOrEqual(placed[0].rw + EPS);
    expect(placed[0].h).toBeLessThanOrEqual(placed[0].rh + EPS);
  });
});
