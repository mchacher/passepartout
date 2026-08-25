// Note geometry and text layout (spec 039). Pure, framework-free: it takes plain numbers
// and a measuring callback, and returns plain numbers, so the editor, the thumbnails, the
// book preview and the 300 DPI painter all lay a note out with the same math.
//
// A note is an OVERLAY. Nothing here is ever fed to src/lib/layout.ts: no photo is moved,
// resized or clipped because a note exists. The engine does not know notes exist.
//
// Sizes and positions are fractions of the PAGE, never pixels, which is what makes a note
// land on the same spot at any zoom and at print resolution.

import { clampRotation } from "./rotation";
import { DEFAULT_SHIPPED_FONT, shippedFontById } from "./fonts";
import type { Note, NoteAlign, NoteInkId, NoteSizeLevel, NoteTarget } from "../types";

/**
 * The single name for a note's container: the key the store coalesces undo steps on and the
 * key the view store's selection carries. Built in one place so a page and its toolbar can
 * never disagree about which note is selected.
 */
export function noteTargetKey(target: NoteTarget): string {
  return target.kind === "page" ? `page:${target.pageId}` : `cover:${target.face}`;
}

/** The five note sizes, as a fraction of the page width. */
export const NOTE_SIZES: Record<NoteSizeLevel, number> = {
  xs: 0.016,
  sm: 0.022,
  md: 0.03,
  lg: 0.042,
  xl: 0.058,
};

export const NOTE_SIZE_LEVELS: NoteSizeLevel[] = ["xs", "sm", "md", "lg", "xl"];
export const DEFAULT_NOTE_SIZE: NoteSizeLevel = "sm";

export const NOTE_ALIGNS: NoteAlign[] = ["left", "center", "right"];
export const NOTE_INKS: NoteInkId[] = ["ink", "inkSoft", "accent", "paper", "custom"];

/** The opacity steps offered besides fully opaque. */
export const NOTE_OPACITIES = [0.6, 0.3] as const;

/**
 * The canonical width every note is wrapped at, in abstract units. Wrapping happens at this
 * one size everywhere (editor at any zoom, page rail thumbnail, book preview, PDF), and the
 * resulting lines are then drawn at whatever size the surface is. Without it a note would
 * break its lines differently in a 60 px thumbnail and on a 7 inch page, and the promise
 * that the printed note is the previewed note would be false.
 */
export const NOTE_REF_W = 1000;

/** Line height, as a multiple of the font size. Shared by the screen and the painter. */
export const NOTE_LINE = 1.35;

/**
 * Letter spacing added by the small-caps treatment, in em. It is added AFTER every
 * character, including the last, which is what CSS `letter-spacing` does: the painter has
 * to mirror that or a centered line would drift by half a space.
 */
export const NOTE_TRACKING = 0.2;

/** Padding of the paper reserve, in em. The screen and the painter share it. */
export const CARTOUCHE_PAD_X = 0.9;
export const CARTOUCHE_PAD_Y = 0.45;

/** Gap between the text and a hairline rule, in em. Shared the same way. */
export const RULE_GAP = 0.5;

/** Thickness of that rule, in em. A hairline: it must stay a hairline at every size. */
export const RULE_WEIGHT = 0.045;

/** The narrowest a note box may get, as a fraction of the page width. */
export const NOTE_MIN_W = 0.08;

/** The width a fresh note starts at. */
export const DEFAULT_NOTE_W = 0.5;

/** The album colors a note's ink is resolved against. */
export interface NotePalette {
  ink: string;
  inkSoft: string;
  accent: string;
  paper: string;
}

/** A note's font size in the caller's unit: px on screen, pt in print. */
export function noteFontSize(level: NoteSizeLevel | undefined, pageW: number): number {
  const f = NOTE_SIZES[level ?? DEFAULT_NOTE_SIZE] ?? NOTE_SIZES[DEFAULT_NOTE_SIZE];
  return f * pageW;
}

/**
 * The width of `text` once tracking is applied. `measure` returns the natural advance
 * width of a string at the note's size; tracking is then added per character, exactly as
 * CSS does, so the screen and the PDF agree.
 */
export function measureTracked(text: string, measure: (s: string) => number, tracking = 0): number {
  if (text.length === 0) return 0;
  return measure(text) + tracking * text.length;
}

/**
 * Wrap `text` to `maxWidth` with a greedy line breaker. Explicit line breaks are always
 * honoured (an empty segment keeps its blank line). A word wider than the box is kept whole
 * on its own line and is allowed to overflow: a note is never hyphenated and never breaks a
 * word, because the printed result has to be the one the editor showed.
 *
 * `measure` is the only impure part, injected by the caller: a canvas 2d context on screen,
 * the embedded font's metrics in the painter. Both read the same font file.
 */
export function wrapLines(
  text: string,
  maxWidth: number,
  measure: (s: string) => number,
): string[] {
  if (text.trim().length === 0) return [];
  const out: string[] = [];
  for (const segment of text.split("\n")) {
    const words = segment.split(/\s+/).filter((w) => w.length > 0);
    if (words.length === 0) {
      out.push("");
      continue;
    }
    let line = words[0];
    for (let i = 1; i < words.length; i++) {
      const candidate = `${line} ${words[i]}`;
      if (measure(candidate) <= maxWidth) {
        line = candidate;
      } else {
        out.push(line);
        line = words[i];
      }
    }
    out.push(line);
  }
  return out;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const finite = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

/**
 * Keep a note usable: a sane width, a box that stays fully inside the page, a tilt inside
 * the decorative range and an opacity from the offered set. `hFrac` is the note's measured
 * height as a fraction of the page height; pass 0 when it is not known yet (the centre is
 * then only kept on the page). The clamp works on the untilted box: a tilted note may
 * overhang slightly, which is what a tilted note is supposed to look like.
 */
export function clampNote(note: Note, hFrac = 0): Note {
  const w = clamp(finite(note.w, DEFAULT_NOTE_W), NOTE_MIN_W, 1);
  const h = clamp(finite(hFrac, 0), 0, 1);
  const out: Note = {
    ...note,
    w,
    x: clamp(finite(note.x, 0.5), w / 2, 1 - w / 2),
    y: clamp(finite(note.y, 0.5), h / 2, 1 - h / 2),
  };
  const rot = clampRotation(finite(note.rotation, 0));
  if (rot) out.rotation = rot;
  else delete out.rotation;
  const op = NOTE_OPACITIES.find((o) => Math.abs(o - finite(note.opacity, 1)) < 1e-6);
  if (op) out.opacity = op;
  else delete out.opacity;
  return out;
}

/** The placement guides a dragged note is gently attracted to. */
export const NOTE_SNAP_TARGETS = [0.5, 0.07, 0.93, 1 / 3, 2 / 3];

/**
 * Soft magnetism for a drag: snap each axis to the nearest guide (the centre, the page
 * margins, the thirds) when it is within `threshold`, otherwise leave it free. Same spirit
 * as `snapAnchor` in grid-edit.ts: free between the snap zones, gently attracted on them.
 */
export function snapNotePlacement(x: number, y: number, threshold = 0.015): { x: number; y: number } {
  const snap = (v: number) => {
    for (const t of NOTE_SNAP_TARGETS) {
      if (Math.abs(v - t) <= threshold) return t;
    }
    return v;
  };
  return { x: snap(x), y: snap(y) };
}

/** Resolve a note's ink against the album palette. */
export function noteInk(
  ink: NoteInkId | undefined,
  customInk: string | undefined,
  palette: NotePalette,
): string {
  switch (ink) {
    case "inkSoft":
      return palette.inkSoft;
    case "accent":
      return palette.accent;
    case "paper":
      return palette.paper;
    case "custom":
      return customInk && /^#[0-9a-fA-F]{3,8}$/.test(customInk) ? customInk : palette.ink;
    default:
      return palette.ink;
  }
}

/** A fresh note at the centre of the page, with the defaults. */
export function newNote(id: string, patch: Partial<Note> = {}): Note {
  return {
    id,
    text: "",
    x: 0.5,
    y: 0.5,
    w: DEFAULT_NOTE_W,
    font: DEFAULT_SHIPPED_FONT,
    size: DEFAULT_NOTE_SIZE,
    align: "center",
    ink: "ink",
    ...patch,
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/**
 * Coerce whatever a stored document holds into valid notes: an unknown font, size, ink or
 * alignment falls back to the default (the note is kept, never silently dropped), while an
 * entry without an id or a text field is not a note at all and is dropped. Same contract as
 * `coverOrDefault` / `textSizesOrDefault`.
 */
export function coerceNotes(value: unknown): Note[] {
  if (!Array.isArray(value)) return [];
  const out: Note[] = [];
  for (const raw of value) {
    if (!isRecord(raw)) continue;
    if (typeof raw.id !== "string" || typeof raw.text !== "string") continue;
    const size = NOTE_SIZE_LEVELS.includes(raw.size as NoteSizeLevel)
      ? (raw.size as NoteSizeLevel)
      : DEFAULT_NOTE_SIZE;
    const align = NOTE_ALIGNS.includes(raw.align as NoteAlign) ? (raw.align as NoteAlign) : "center";
    const ink = NOTE_INKS.includes(raw.ink as NoteInkId) ? (raw.ink as NoteInkId) : "ink";
    const note: Note = {
      id: raw.id,
      text: raw.text,
      x: finite(raw.x, 0.5),
      y: finite(raw.y, 0.5),
      w: finite(raw.w, DEFAULT_NOTE_W),
      font: shippedFontById(raw.font as string).id,
      size,
      align,
      ink,
    };
    if (raw.bold === true) note.bold = true;
    if (raw.italic === true) note.italic = true;
    if (typeof raw.customInk === "string") note.customInk = raw.customInk;
    if (raw.caps === true) note.caps = true;
    if (raw.rule === "over" || raw.rule === "under") note.rule = raw.rule;
    if (raw.cartouche === true) note.cartouche = true;
    if (typeof raw.rotation === "number") note.rotation = raw.rotation;
    if (typeof raw.opacity === "number") note.opacity = raw.opacity;
    out.push(clampNote(note));
  }
  return out;
}
