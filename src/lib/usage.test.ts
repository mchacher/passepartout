import { describe, it, expect } from "vitest";
import { countUsage, usageCount, isUnused } from "./usage";
import { DEFAULT_WHITESPACE, DEFAULT_LAYOUT_ID, type AlbumPage } from "../types";

const page = (id: string, photoIds: string[]): AlbumPage => ({
  id,
  title: "",
  subtitle: "",
  photoIds,
  whitespace: DEFAULT_WHITESPACE,
  layoutId: DEFAULT_LAYOUT_ID,
});

describe("countUsage", () => {
  it("counts a photo used on two pages", () => {
    const map = countUsage([page("p1", ["a", "b"]), page("p2", ["a"])], []);
    expect(usageCount(map, "a")).toBe(2);
    expect(usageCount(map, "b")).toBe(1);
  });

  it("includes cover faces in the count", () => {
    const map = countUsage([page("p1", ["a"])], ["a", null, "c", null]);
    expect(usageCount(map, "a")).toBe(2); // one page + one cover
    expect(usageCount(map, "c")).toBe(1); // cover only
  });

  it("reports an unplaced photo as unused", () => {
    const map = countUsage([page("p1", ["a"])], [null, null, null, null]);
    expect(usageCount(map, "z")).toBe(0);
    expect(isUnused(map, "z")).toBe(true);
    expect(isUnused(map, "a")).toBe(false);
  });

  it("ignores null cover ids (no phantom counts)", () => {
    const map = countUsage([], [null, null, null, null]);
    expect(map.size).toBe(0);
  });
});
