import { describe, it, expect } from "vitest";
import { photoKey, splitDuplicates } from "./dedupe";

const id = (over: Partial<Parameters<typeof photoKey>[0]> = {}) => ({
  name: "IMG_1.jpg",
  w: 4032,
  h: 3024,
  time: 1_700_000_000_000,
  ...over,
});

describe("photoKey", () => {
  it("is equal for the same name, dimensions and capture time", () => {
    expect(photoKey(id())).toBe(photoKey(id()));
  });

  it("differs on the name, on either dimension, and on the capture time", () => {
    const base = photoKey(id());
    expect(photoKey(id({ name: "IMG_2.jpg" }))).not.toBe(base);
    expect(photoKey(id({ w: 4031 }))).not.toBe(base);
    expect(photoKey(id({ h: 3023 }))).not.toBe(base);
    expect(photoKey(id({ time: 1_700_000_000_001 }))).not.toBe(base);
  });

  it("does not collide across a swap of the differing fields", () => {
    // A naive concatenation could make ("a", 1x2) and ("a1", 2) collide.
    expect(photoKey(id({ name: "a", w: 1, h: 2 }))).not.toBe(photoKey(id({ name: "a1", w: 2, h: 2 })));
  });
});

describe("splitDuplicates", () => {
  it("keeps everything when the library is empty and the batch is unique", () => {
    const batch = [id({ name: "a.jpg" }), id({ name: "b.jpg" })];
    const { kept, skipped } = splitDuplicates([], batch);
    expect(kept).toEqual(batch);
    expect(skipped).toEqual([]);
  });

  it("skips a photo already in the library", () => {
    const existing = [id({ name: "a.jpg" })];
    const { kept, skipped } = splitDuplicates(existing, [id({ name: "a.jpg" }), id({ name: "b.jpg" })]);
    expect(kept.map((p) => p.name)).toEqual(["b.jpg"]);
    expect(skipped.map((p) => p.name)).toEqual(["a.jpg"]);
  });

  it("adds a file listed twice in one batch only once, first occurrence wins", () => {
    const first = { ...id({ name: "a.jpg" }), tag: "first" };
    const second = { ...id({ name: "a.jpg" }), tag: "second" };
    const { kept, skipped } = splitDuplicates([], [first, second]);
    expect(kept).toEqual([first]);
    expect(skipped).toEqual([second]);
  });

  it("skips the whole batch when every file is already there", () => {
    const existing = [id({ name: "a.jpg" }), id({ name: "b.jpg" })];
    const { kept, skipped } = splitDuplicates(existing, [id({ name: "b.jpg" }), id({ name: "a.jpg" })]);
    expect(kept).toEqual([]);
    expect(skipped).toHaveLength(2);
  });

  it("treats a renamed copy as a different photo (documented limit)", () => {
    const existing = [id({ name: "IMG_1.jpg" })];
    const { kept } = splitDuplicates(existing, [id({ name: "holiday-01.jpg" })]);
    expect(kept).toHaveLength(1);
  });

  it("preserves the order of the kept photos", () => {
    const batch = [id({ name: "c.jpg" }), id({ name: "a.jpg" }), id({ name: "b.jpg" })];
    const { kept } = splitDuplicates([], batch);
    expect(kept.map((p) => p.name)).toEqual(["c.jpg", "a.jpg", "b.jpg"]);
  });
});
