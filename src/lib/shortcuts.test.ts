import { describe, it, expect } from "vitest";
import { shortcutFor, UNDO_HINT, REDO_HINT, MODIFIER } from "./shortcuts";

const stroke = (over: Partial<Parameters<typeof shortcutFor>[0]>) => ({
  key: "z",
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  ...over,
});

describe("shortcutFor", () => {
  it("reads Ctrl+Z and Cmd+Z as undo", () => {
    expect(shortcutFor(stroke({ ctrlKey: true }))).toBe("undo");
    expect(shortcutFor(stroke({ metaKey: true }))).toBe("undo");
  });

  it("reads the shifted form and Ctrl+Y as redo", () => {
    expect(shortcutFor(stroke({ ctrlKey: true, shiftKey: true }))).toBe("redo");
    expect(shortcutFor(stroke({ metaKey: true, shiftKey: true }))).toBe("redo");
    expect(shortcutFor(stroke({ key: "y", ctrlKey: true }))).toBe("redo");
  });

  it("ignores the same letters without a modifier", () => {
    expect(shortcutFor(stroke({}))).toBeNull();
    expect(shortcutFor(stroke({ key: "y" }))).toBeNull();
    expect(shortcutFor(stroke({ shiftKey: true }))).toBeNull();
  });

  it("ignores other modified keys, so nothing else is swallowed", () => {
    for (const key of ["s", "c", "v", "a", "Enter", "ArrowLeft"]) {
      expect(shortcutFor(stroke({ key, ctrlKey: true })), key).toBeNull();
    }
  });

  it("does not care about the case of the key", () => {
    expect(shortcutFor(stroke({ key: "Z", ctrlKey: true }))).toBe("undo");
    expect(shortcutFor(stroke({ key: "Y", ctrlKey: true }))).toBe("redo");
  });

  it("spells the hints with the platform modifier", () => {
    expect([`Ctrl`, `Cmd`]).toContain(MODIFIER);
    expect(UNDO_HINT).toBe(`${MODIFIER}+Z`);
    expect(REDO_HINT).toBe(`${MODIFIER}+Shift+Z`);
  });
});
