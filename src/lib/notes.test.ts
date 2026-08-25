import { describe, expect, it } from "vitest";
import {
  clampNote,
  coerceNotes,
  DEFAULT_NOTE_SIZE,
  DEFAULT_NOTE_W,
  measureTracked,
  newNote,
  noteFontSize,
  noteInk,
  NOTE_MIN_W,
  NOTE_SIZE_LEVELS,
  NOTE_SIZES,
  snapNotePlacement,
  wrapLines,
} from "./notes";
import { ROTATION_MAX } from "./rotation";
import type { Note } from "../types";

// A deterministic stand-in for a font: every character is one unit wide. It makes the
// wrapping assertions exact without dragging a canvas or a real font into a unit test.
const monoMeasure = (s: string) => s.length;

const palette = { ink: "#111111", inkSoft: "#555555", accent: "#37596b", paper: "#ffffff" };

describe("wrapLines", () => {
  it("keeps a phrase narrower than the box on one line", () => {
    expect(wrapLines("le dernier soir", 100, monoMeasure)).toEqual(["le dernier soir"]);
  });

  it("greedily splits a phrase wider than the box, losing no word", () => {
    const text = "le dernier soir sur la presqu'ile";
    const lines = wrapLines(text, 12, monoMeasure);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(monoMeasure(line)).toBeLessThanOrEqual(12);
    expect(lines.join(" ")).toBe(text);
  });

  it("always honours explicit line breaks and wraps each segment on its own", () => {
    const lines = wrapLines("le sentier\nderriere la maison", 12, monoMeasure);
    expect(lines[0]).toBe("le sentier");
    expect(lines.slice(1).join(" ")).toBe("derriere la maison");
  });

  it("keeps a blank line inside a multi-line note", () => {
    expect(wrapLines("un\n\ndeux", 40, monoMeasure)).toEqual(["un", "", "deux"]);
  });

  it("keeps a word wider than the box whole, on its own line", () => {
    const lines = wrapLines("court anticonstitutionnellement fin", 10, monoMeasure);
    expect(lines).toContain("anticonstitutionnellement");
  });

  it("returns no line for empty or whitespace-only text", () => {
    expect(wrapLines("", 100, monoMeasure)).toEqual([]);
    expect(wrapLines("   \n  ", 100, monoMeasure)).toEqual([]);
  });
});

describe("noteFontSize", () => {
  it("is the documented fraction of the page width at every level", () => {
    for (const level of NOTE_SIZE_LEVELS) {
      expect(noteFontSize(level, 1000)).toBeCloseTo(NOTE_SIZES[level] * 1000, 6);
    }
  });

  it("grows monotonically from xs to xl", () => {
    const sizes = NOTE_SIZE_LEVELS.map((l) => noteFontSize(l, 1000));
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]).toBeGreaterThan(sizes[i - 1]);
  });

  it("falls back to the default size for a missing level", () => {
    expect(noteFontSize(undefined, 1000)).toBeCloseTo(NOTE_SIZES[DEFAULT_NOTE_SIZE] * 1000, 6);
  });
});

describe("measureTracked", () => {
  it("is the natural width when there is no tracking", () => {
    expect(measureTracked("abcd", monoMeasure, 0)).toBe(4);
  });

  it("adds the tracking after every character, including the last (the CSS rule)", () => {
    expect(measureTracked("abcd", monoMeasure, 0.5)).toBe(4 + 4 * 0.5);
  });

  it("is zero for an empty string", () => {
    expect(measureTracked("", monoMeasure, 0.5)).toBe(0);
  });
});

describe("clampNote", () => {
  const base = (patch: Partial<Note> = {}): Note => newNote("n1", patch);

  it("keeps the box fully inside the page when dragged past an edge", () => {
    const n = clampNote(base({ x: 1.4, y: -0.3, w: 0.4 }), 0.2);
    expect(n.x).toBeCloseTo(1 - 0.4 / 2, 6);
    expect(n.y).toBeCloseTo(0.2 / 2, 6);
    expect(n.w).toBeCloseTo(0.4, 6);
  });

  it("clamps the width to the allowed range", () => {
    expect(clampNote(base({ w: 0.001 })).w).toBeCloseTo(NOTE_MIN_W, 6);
    expect(clampNote(base({ w: 4 })).w).toBeCloseTo(1, 6);
  });

  it("clamps a tilt to the decorative range and drops a level one", () => {
    expect(clampNote(base({ rotation: 90 })).rotation).toBe(ROTATION_MAX);
    expect(clampNote(base({ rotation: -90 })).rotation).toBe(-ROTATION_MAX);
    expect(clampNote(base({ rotation: 0 })).rotation).toBeUndefined();
  });

  it("keeps only an offered opacity step", () => {
    expect(clampNote(base({ opacity: 0.6 })).opacity).toBe(0.6);
    expect(clampNote(base({ opacity: 0.42 })).opacity).toBeUndefined();
    expect(clampNote(base({ opacity: 1 })).opacity).toBeUndefined();
  });

  it("repairs a non-finite placement rather than propagating NaN", () => {
    const n = clampNote(base({ x: Number.NaN, y: Number.POSITIVE_INFINITY, w: Number.NaN }));
    expect(Number.isFinite(n.x)).toBe(true);
    expect(Number.isFinite(n.y)).toBe(true);
    expect(n.w).toBeCloseTo(DEFAULT_NOTE_W, 6);
  });
});

describe("snapNotePlacement", () => {
  it("snaps to the page centre when close to it", () => {
    expect(snapNotePlacement(0.505, 0.497).x).toBe(0.5);
    expect(snapNotePlacement(0.505, 0.497).y).toBe(0.5);
  });

  it("snaps to a margin and to a third", () => {
    expect(snapNotePlacement(0.072, 0.334).x).toBeCloseTo(0.07, 6);
    expect(snapNotePlacement(0.072, 0.334).y).toBeCloseTo(1 / 3, 6);
  });

  it("leaves a placement between the snap zones free", () => {
    const p = snapNotePlacement(0.2, 0.8);
    expect(p.x).toBeCloseTo(0.2, 6);
    expect(p.y).toBeCloseTo(0.8, 6);
  });
});

describe("noteInk", () => {
  it("resolves every album ink", () => {
    expect(noteInk("ink", undefined, palette)).toBe(palette.ink);
    expect(noteInk("inkSoft", undefined, palette)).toBe(palette.inkSoft);
    expect(noteInk("accent", undefined, palette)).toBe(palette.accent);
    expect(noteInk("paper", undefined, palette)).toBe(palette.paper);
  });

  it("resolves a custom hex, and falls back to the ink when it is not one", () => {
    expect(noteInk("custom", "#8c5a3c", palette)).toBe("#8c5a3c");
    expect(noteInk("custom", "not a color", palette)).toBe(palette.ink);
    expect(noteInk("custom", undefined, palette)).toBe(palette.ink);
  });

  it("falls back to the ink for a missing id", () => {
    expect(noteInk(undefined, undefined, palette)).toBe(palette.ink);
  });
});

describe("coerceNotes", () => {
  it("keeps a note whose font, size, ink or alignment is unknown, with the defaults", () => {
    const [note] = coerceNotes([
      { id: "n1", text: "hello", font: "comic", size: "huge", ink: "neon", align: "justify" },
    ]);
    expect(note.font).toBe("garamond");
    expect(note.size).toBe(DEFAULT_NOTE_SIZE);
    expect(note.ink).toBe("ink");
    expect(note.align).toBe("center");
  });

  it("drops an entry that is not a note and keeps the rest", () => {
    const notes = coerceNotes([{ id: "n1", text: "kept" }, { text: "no id" }, null, 7, { id: "n2" }]);
    expect(notes.map((n) => n.id)).toEqual(["n1"]);
  });

  it("round-trips a complete note", () => {
    const full = {
      id: "n1",
      text: "Le dernier soir",
      x: 0.4,
      y: 0.7,
      w: 0.6,
      rotation: -5,
      font: "playfair",
      size: "lg",
      bold: true,
      italic: true,
      align: "right",
      ink: "custom",
      customInk: "#8c5a3c",
      caps: true,
      rule: "under",
      opacity: 0.6,
      cartouche: true,
    };
    expect(coerceNotes([full])[0]).toMatchObject({
      id: "n1",
      text: "Le dernier soir",
      w: 0.6,
      rotation: -5,
      font: "playfair",
      size: "lg",
      bold: true,
      italic: true,
      align: "right",
      ink: "custom",
      customInk: "#8c5a3c",
      caps: true,
      rule: "under",
      opacity: 0.6,
      cartouche: true,
    });
  });

  it("returns no note for anything that is not an array", () => {
    expect(coerceNotes(undefined)).toEqual([]);
    expect(coerceNotes({})).toEqual([]);
  });
});
