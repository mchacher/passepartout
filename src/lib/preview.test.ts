import { describe, it, expect } from "vitest";
import {
  bookLeaves,
  toSpreads,
  spreadIndexOfLeaf,
  spreadLabel,
  fitSpread,
  type Leaf,
} from "./preview";

const pageIds = ["p1", "p2", "p3"];

describe("bookLeaves", () => {
  it("orders leaves front, inside front, pages, inside back, back", () => {
    const leaves = bookLeaves(pageIds);
    expect(leaves.map((l) => (l.kind === "cover" ? l.face : l.pageId))).toEqual([
      "front",
      "insideFront",
      "p1",
      "p2",
      "p3",
      "insideBack",
      "back",
    ]);
  });

  it("labels each leaf", () => {
    const leaves = bookLeaves(pageIds);
    expect(leaves.map((l) => l.label)).toEqual([
      "Front cover",
      "Inside front",
      "Page 1",
      "Page 2",
      "Page 3",
      "Inside back",
      "Back cover",
    ]);
  });

  it("keeps the two covers even with no pages", () => {
    const leaves = bookLeaves([]);
    expect(leaves.map((l) => l.label)).toEqual([
      "Front cover",
      "Inside front",
      "Inside back",
      "Back cover",
    ]);
  });
});

describe("toSpreads", () => {
  it("makes the front cover a single, then (verso, recto) pairs", () => {
    const leaves = bookLeaves(pageIds); // 7 leaves
    const spreads = toSpreads(leaves);
    expect(spreads.map((s) => s.map((l) => l.label))).toEqual([
      ["Front cover"],
      ["Inside front", "Page 1"],
      ["Page 2", "Page 3"],
      ["Inside back", "Back cover"],
    ]);
  });

  it("leaves a trailing odd leaf as a single spread", () => {
    // 4 leaves (no pages) -> front single, then one pair, then back single.
    const spreads = toSpreads(bookLeaves([]));
    expect(spreads.map((s) => s.length)).toEqual([1, 2, 1]);
  });

  it("never drops or reorders a leaf (flatten === input)", () => {
    const leaves = bookLeaves(["a", "b", "c", "d"]);
    const flat = toSpreads(leaves).flat();
    expect(flat).toEqual(leaves);
  });

  it("returns no spreads for no leaves", () => {
    expect(toSpreads([])).toEqual([]);
  });
});

describe("spreadIndexOfLeaf", () => {
  it("finds the spread that contains a given page", () => {
    const spreads = toSpreads(bookLeaves(pageIds));
    const idx = spreadIndexOfLeaf(
      spreads,
      (l) => l.kind === "page" && l.pageId === "p2",
    );
    // p2 is in the third spread [Page 2, Page 3].
    expect(idx).toBe(2);
  });

  it("returns -1 when no leaf matches", () => {
    const spreads = toSpreads(bookLeaves(pageIds));
    expect(spreadIndexOfLeaf(spreads, () => false)).toBe(-1);
  });
});

describe("spreadLabel", () => {
  it("joins leaf labels with a slash", () => {
    const spread: Leaf[] = [
      { kind: "cover", face: "insideFront", label: "Inside front" },
      { kind: "page", pageId: "p1", index: 0, label: "Page 1" },
    ];
    expect(spreadLabel(spread)).toBe("Inside front / Page 1");
  });
});

describe("fitSpread", () => {
  const aspect = 1.5; // wider than tall

  it("preserves the page ratio exactly at any stage size", () => {
    for (const avail of [
      { w: 1000, h: 600 },
      { w: 300, h: 900 },
      { w: 640, h: 480 },
    ]) {
      for (const n of [1, 2] as const) {
        const { pageW, pageH } = fitSpread(avail, aspect, n, 0.04);
        expect(pageW / pageH).toBeCloseTo(aspect, 6);
      }
    }
  });

  it("is width-bound on a wide short stage and never overflows", () => {
    const avail = { w: 800, h: 2000 };
    const gutter = 0.04;
    const { pageW, pageH } = fitSpread(avail, aspect, 2, gutter);
    const spreadW = 2 * pageW + gutter * pageW;
    expect(spreadW).toBeCloseTo(avail.w, 6); // width binds exactly
    expect(pageH).toBeLessThanOrEqual(avail.h + 1e-6);
  });

  it("is height-bound on a tall narrow stage and never overflows", () => {
    const avail = { w: 5000, h: 400 };
    const gutter = 0.04;
    const { pageW, pageH } = fitSpread(avail, aspect, 2, gutter);
    expect(pageH).toBeCloseTo(avail.h, 6); // height binds exactly
    const spreadW = 2 * pageW + gutter * pageW;
    expect(spreadW).toBeLessThanOrEqual(avail.w + 1e-6);
  });

  it("maximizes a single leaf (n=1) within the stage", () => {
    const avail = { w: 1000, h: 500 };
    const { pageW, pageH } = fitSpread(avail, aspect, 1, 0.04);
    expect(pageW / pageH).toBeCloseTo(aspect, 6);
    expect(pageW).toBeLessThanOrEqual(avail.w + 1e-6);
    expect(pageH).toBeLessThanOrEqual(avail.h + 1e-6);
    // Height binds here (1000/500 = 2 > aspect 1.5), so pageH === avail.h.
    expect(pageH).toBeCloseTo(avail.h, 6);
  });

  it("touches at least one constraint (cannot grow further)", () => {
    const avail = { w: 900, h: 500 };
    const gutter = 0.04;
    const { pageW, pageH } = fitSpread(avail, aspect, 2, gutter);
    const spreadW = 2 * pageW + gutter * pageW;
    const widthTight = Math.abs(spreadW - avail.w) < 1e-6;
    const heightTight = Math.abs(pageH - avail.h) < 1e-6;
    expect(widthTight || heightTight).toBe(true);
  });

  it("returns zero for a degenerate stage", () => {
    expect(fitSpread({ w: 0, h: 100 }, aspect, 2, 0.04)).toEqual({ pageW: 0, pageH: 0 });
  });
});
