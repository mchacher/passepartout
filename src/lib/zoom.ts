// Editor zoom (spec 016), a pure helper. The zoom level scales the width the central
// editing column renders at; it does NOT touch the layout engine, so photos stay
// contain-fit at the new width and nothing is cropped. 100% (1) is today's size.

export const ZOOM_MIN = 0.8;
export const ZOOM_MAX = 1.6;
export const ZOOM_STEP = 0.1;
export const ZOOM_DEFAULT = 1;

/** The central column's width at 100% zoom, in px (mirrors App.tsx's baseline). */
export const BASE_WIDTH_PX = 620;

/** Clamp a zoom to the valid range; a non-finite value falls back to the default. */
export function clampZoom(z: number): number {
  if (!Number.isFinite(z)) return ZOOM_DEFAULT;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

/** The central column's width in px for a given zoom (clamped first). */
export function zoomWidthPx(z: number): number {
  return Math.round(BASE_WIDTH_PX * clampZoom(z));
}
