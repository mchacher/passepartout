// Crop geometry (pure, framework-free) for the photo crop tool (spec 015). A crop is a
// normalized sub-rectangle of the source that the user chose to keep; the kept region is
// shown contain-fit (undistorted), so its aspect is the photo's "effective ratio". No-crop
// (an absent or full crop) is the whole image, the default.

import type { CropRect } from "../types";

export const DEFAULT_CROP: CropRect = { x: 0, y: 0, w: 1, h: 1 };
// Smallest crop side, so a rectangle can never collapse to zero area.
export const MIN_CROP = 0.05;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** The ratio of the KEPT region: the source ratio times the crop's aspect factor. */
export function effectiveRatio(ratio: number, crop?: CropRect): number {
  if (!crop || crop.h <= 0) return ratio;
  return ratio * (crop.w / crop.h);
}

/** Pull a crop rectangle inside [0,1] with a minimum size and no overflow past the edges. */
export function clampCrop(crop: CropRect): CropRect {
  const w = clamp(crop.w, MIN_CROP, 1);
  const h = clamp(crop.h, MIN_CROP, 1);
  const x = clamp(crop.x, 0, 1 - w);
  const y = clamp(crop.y, 0, 1 - h);
  return { x, y, w, h };
}

/** Translate a crop by normalized deltas, clamped so it stays inside the image. */
export function moveCropRect(crop: CropRect, dx: number, dy: number): CropRect {
  return clampCrop({ ...crop, x: crop.x + dx, y: crop.y + dy });
}

/** One of the 8 crop handles: 4 corners + 4 edges. */
export type CropHandle = "tl" | "tr" | "bl" | "br" | "t" | "b" | "l" | "r";

/**
 * Resize a crop by dragging one handle by normalized deltas. The opposite side stays put;
 * sides stay >= MIN_CROP apart and inside the image (edge handles move only one axis).
 */
export function resizeCropRect(crop: CropRect, handle: CropHandle, dx: number, dy: number): CropRect {
  let left = crop.x;
  let top = crop.y;
  let right = crop.x + crop.w;
  let bottom = crop.y + crop.h;

  if (handle.includes("l")) left = clamp(left + dx, 0, right - MIN_CROP);
  if (handle.includes("r")) right = clamp(right + dx, left + MIN_CROP, 1);
  if (handle.includes("t")) top = clamp(top + dy, 0, bottom - MIN_CROP);
  if (handle.includes("b")) bottom = clamp(bottom + dy, top + MIN_CROP, 1);

  return { x: left, y: top, w: right - left, h: bottom - top };
}

/**
 * The displayed image box for rendering a crop inside a `boxW` x `boxH` frame: the image is
 * scaled so its crop rectangle exactly fills the frame, and offset so the crop's top-left
 * sits at the frame's top-left. A full crop gives image == frame, offset 0 (a plain image).
 */
export function cropImgBox(
  crop: CropRect | undefined,
  boxW: number,
  boxH: number,
): { w: number; h: number; ox: number; oy: number } {
  if (!crop || crop.w <= 0 || crop.h <= 0) return { w: boxW, h: boxH, ox: 0, oy: 0 };
  const w = boxW / crop.w;
  const h = boxH / crop.h;
  return { w, h, ox: -crop.x * w || 0, oy: -crop.y * h || 0 };
}
