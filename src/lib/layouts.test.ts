import { describe, it, expect } from "vitest";
import {
  CATALOG,
  autoTemplate,
  defaultLayoutId,
  getLayout,
  layoutsForCount,
  leafCount,
} from "./layouts";

describe("layout catalog", () => {
  it("every template's leaf count matches its declared count", () => {
    for (const tpl of CATALOG) {
      expect(leafCount(tpl.node)).toBe(tpl.count);
    }
  });

  it("has unique, stable ids", () => {
    const ids = CATALOG.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("offers at least one template for each count 1..4", () => {
    for (let n = 1; n <= 4; n++) {
      expect(layoutsForCount(n).length).toBeGreaterThan(0);
    }
  });

  it("defaultLayoutId(n) returns a template of that count for 1..4", () => {
    for (let n = 1; n <= 4; n++) {
      const tpl = getLayout(defaultLayoutId(n));
      expect(tpl?.count).toBe(n);
    }
  });

  it("defaultLayoutId falls back to 'auto' outside 1..4", () => {
    expect(defaultLayoutId(0)).toBe("auto");
    expect(defaultLayoutId(7)).toBe("auto");
    expect(getLayout("auto")).toBeUndefined();
  });

  it("autoTemplate produces exactly n slots (min 1) for any n", () => {
    for (const n of [0, 1, 2, 5, 7, 10]) {
      expect(leafCount(autoTemplate(n))).toBe(n <= 1 ? 1 : n);
    }
  });

  it("autoTemplate(1) is a single slot", () => {
    expect(autoTemplate(1)).toEqual({ kind: "slot" });
  });
});
