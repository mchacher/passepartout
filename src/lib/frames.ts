// Decorative photo frames (spec 019), a pure catalog. A frame mats a photo in a colored
// border. Two families, both opt-in and per-photo:
//   - Border: ADDITIVE (never clips) - the photo is contained inside a uniform border of a
//     selectable width; thin by default.
//   - Polaroid: a square window (the photo is cover-cropped to a square, pannable with a
//     focus) over a thick bottom band that holds an optional handwritten note.
// The engine sizes a framed cell to the frame's OUTER ratio (frameLayoutRatio); the frame
// geometry is otherwise drawn inside that box. Enrichable: add a style or a color entry.

import type { CropFocus, CropRect } from "../types";
import { effectiveRatio } from "./crop";

export interface FrameStyle {
  id: string;
  name: string;
  /** True for the Polaroid: a square, cover-cropped window with a note band. */
  square: boolean;
  /** True when the style has a bottom band for a handwritten note. */
  hasText: boolean;
  defaultColor: string;
}

export interface FrameColor {
  id: string;
  name: string;
  value: string; // the frame (mat) color
  ink: string; // the note's text color on that frame
}

export const FRAMES: FrameStyle[] = [
  { id: "polaroid", name: "Polaroid", square: true, hasText: true, defaultColor: "white" },
  { id: "border", name: "Border", square: false, hasText: false, defaultColor: "white" },
];

// Polaroid mat, as fractions of the OUTER width: thin top / sides, a thick bottom band, and
// a square photo window between them. No rounded corners.
const POLA_SIDE = 0.06;
const POLA_TOP = 0.06;
const POLA_BOTTOM = 0.2;
const POLA_WINDOW = 1 - 2 * POLA_SIDE; // the square window side (outer-width units)
/** The Polaroid's fixed outer aspect ratio (width / height). */
export const POLAROID_RATIO = 1 / (POLA_TOP + POLA_WINDOW + POLA_BOTTOM);

// Border widths (fraction of the outer width). Thin is the default.
export const BORDER_WIDTHS: { id: string; label: string; value: number }[] = [
  { id: "thin", label: "Thin", value: 0.018 },
  { id: "medium", label: "Medium", value: 0.04 },
  { id: "thick", label: "Thick", value: 0.075 },
];
export const DEFAULT_BORDER_WIDTH = BORDER_WIDTHS[0].value;

/** Clamp a stored border width to the catalog range, or the default when absent. */
export function borderWidthOf(w: number | undefined): number {
  if (typeof w !== "number" || !Number.isFinite(w)) return DEFAULT_BORDER_WIDTH;
  return Math.max(0.005, Math.min(0.12, w));
}

export const FRAME_COLORS: FrameColor[] = [
  { id: "white", name: "White", value: "#f7f5f0", ink: "#3a3632" },
  { id: "black", name: "Black", value: "#1f1f22", ink: "#ece9e3" },
  { id: "kraft", name: "Kraft", value: "#c8a97e", ink: "#4a3a26" },
  { id: "blush", name: "Blush", value: "#e6c9c6", ink: "#5c3f3d" },
  { id: "sage", name: "Sage", value: "#b9c6b0", ink: "#3d4a37" },
  { id: "navy", name: "Navy", value: "#2b3a55", ink: "#dbe3f0" },
];

/** Look up a frame style by id (undefined for an absent or unknown id). */
export function frameById(id: string | undefined): FrameStyle | undefined {
  return id ? FRAMES.find((f) => f.id === id) : undefined;
}

/** True when id names a catalog frame style. */
export function isFrame(id: string | undefined): boolean {
  return frameById(id) !== undefined;
}

/** A frame color's mat + ink, falling back to the given color id (usually the style default). */
export function frameColorOf(id: string | undefined, fallbackId: string): FrameColor {
  return FRAME_COLORS.find((c) => c.id === id) ?? FRAME_COLORS.find((c) => c.id === fallbackId) ?? FRAME_COLORS[0];
}

/**
 * The OUTER aspect ratio (width / height) the engine should size a framed cell to. Polaroid
 * is fixed (square window + bands); Border adds a uniform border around the photo, so the
 * outer ratio is the photo's ratio adjusted by the border width (the photo fills the inner
 * area with no letterbox).
 */
export function frameLayoutRatio(style: FrameStyle, photoEffRatio: number, frameWidth: number): number {
  if (style.square) return POLAROID_RATIO;
  const bw = borderWidthOf(frameWidth);
  const innerW = 1 - 2 * bw; // outer-width units
  const outerH = innerW / photoEffRatio + 2 * bw;
  return outerH > 0 ? 1 / outerH : photoEffRatio;
}

/**
 * The inner photo area (in px) inside the frame, for a `w` x `h` box. For the Polaroid this
 * is the square window; for the Border it is the box inset by a uniform border.
 */
export function frameInner(style: FrameStyle, w: number, h: number, frameWidth: number): { x: number; y: number; w: number; h: number } {
  if (style.square) {
    const side = POLA_WINDOW * w;
    return { x: POLA_SIDE * w, y: POLA_TOP * w, w: side, h: side };
  }
  const bw = borderWidthOf(frameWidth) * w;
  return { x: bw, y: bw, w: Math.max(0, w - 2 * bw), h: Math.max(0, h - 2 * bw) };
}

/**
 * A square sub-rectangle of the source (in 0..1) for the Polaroid window, positioned by the
 * focus along its overflowing axis. The kept region is square in PIXELS, so a landscape
 * photo pans horizontally and a portrait one vertically; nothing is distorted.
 */
export function squareCrop(sourceRatio: number, focus: CropFocus): CropRect {
  const fx = Math.max(0, Math.min(1, focus.x));
  const fy = Math.max(0, Math.min(1, focus.y));
  if (sourceRatio >= 1) {
    const w = 1 / sourceRatio;
    return { x: fx * (1 - w), y: 0, w, h: 1 };
  }
  const h = sourceRatio;
  return { x: 0, y: fy * (1 - h), w: 1, h };
}

/** The ratio the engine sizes a photo's cell to, honoring an opt-in frame (spec 019). */
export function photoLayoutRatio(photo: { ratio: number; crop?: CropRect; frame?: string; frameWidth?: number }): number {
  const eff = effectiveRatio(photo.ratio, photo.crop);
  const style = frameById(photo.frame);
  return style ? frameLayoutRatio(style, eff, borderWidthOf(photo.frameWidth)) : eff;
}
