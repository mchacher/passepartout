import { describe, it, expect } from "vitest";
import {
  EMPTY_SELECTION,
  selectSingle,
  toggleSelection,
  clampSelection,
  type Selection,
} from "./selection";

describe("selection reducer (spec 055)", () => {
  it("selectSingle keeps only the clicked cell as primary", () => {
    expect(selectSingle(2)).toEqual<Selection>({ indices: [2], primary: 2 });
  });

  it("toggle adds a cell and makes it primary", () => {
    const s = toggleSelection(selectSingle(0), 3);
    expect(s.indices).toEqual([0, 3]);
    expect(s.primary).toBe(3);
  });

  it("toggle removes an already-selected cell and re-homes primary to the last remaining", () => {
    let s = selectSingle(0);
    s = toggleSelection(s, 1); // [0,1] primary 1
    s = toggleSelection(s, 2); // [0,1,2] primary 2
    s = toggleSelection(s, 2); // remove 2 -> [0,1] primary 1
    expect(s).toEqual<Selection>({ indices: [0, 1], primary: 1 });
  });

  it("toggling the last cell out clears primary", () => {
    const s = toggleSelection(selectSingle(4), 4);
    expect(s).toEqual(EMPTY_SELECTION);
  });

  it("a plain click after a multi-selection collapses back to one", () => {
    let s = selectSingle(0);
    s = toggleSelection(s, 1);
    s = toggleSelection(s, 2);
    expect(s.indices).toEqual([0, 1, 2]);
    expect(selectSingle(1)).toEqual<Selection>({ indices: [1], primary: 1 }); // plain click resets
  });

  it("clamp drops out-of-range indices when the photo count shrinks", () => {
    const s: Selection = { indices: [0, 2, 4], primary: 4 };
    const c = clampSelection(s, 3); // only 0,1,2 are valid now
    expect(c.indices).toEqual([0, 2]);
    expect(c.primary).toBe(2); // primary 4 gone -> last remaining
  });

  it("clamp keeps primary when it is still in range", () => {
    const s: Selection = { indices: [0, 1], primary: 0 };
    expect(clampSelection(s, 2)).toEqual<Selection>({ indices: [0, 1], primary: 0 });
  });
});
