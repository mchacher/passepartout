// Cover-crop geometry (pure, framework-free) for full-page "Fill" photos (spec 012).
//
// A `cover` full-page photo fills a box of a different aspect ratio than its own. It is
// scaled proportionally (so its ratio is never changed) and the overflow is clipped. This
// module computes, in the photo's own pixel space, the source rectangle that is kept: the
// largest rectangle of the target aspect ratio that fits inside the photo, positioned by
// a normalized focus. The impure PDF painter re-encodes exactly this rectangle to fill the
// print box, so the export matches the on-screen object-fit: cover / object-position.

import { DEFAULT_CROP_FOCUS, type CropFocus } from "../types";

export interface SourceRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * The source rectangle (in `srcW` x `srcH` pixel space) kept when cover-cropping the
 * source to `targetRatio` (= width / height of the box to fill), positioned by `focus`.
 *
 * Exactly one axis overflows: the rectangle spans the full extent of the non-overflowing
 * axis and is slid along the overflowing one by `focus` (0 = left/top edge, 1 =
 * right/bottom, 0.5 = centered). The rectangle is always fully inside the source, so the
 * scale is proportional and nothing is distorted; only the overflow is dropped.
 */
export function coverSourceRect(
  srcW: number,
  srcH: number,
  targetRatio: number,
  focus: CropFocus = DEFAULT_CROP_FOCUS,
): SourceRect {
  const srcRatio = srcW / srcH;
  if (srcRatio > targetRatio) {
    // Source is wider than the target: crop the width, keep the full height.
    const sw = srcH * targetRatio;
    const sx = clamp01(focus.x) * (srcW - sw);
    return { sx, sy: 0, sw, sh: srcH };
  }
  // Source is taller (or equal): crop the height, keep the full width.
  const sh = srcW / targetRatio;
  const sy = clamp01(focus.y) * (srcH - sh);
  return { sx: 0, sy, sw: srcW, sh };
}
