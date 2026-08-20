// Editor zoom (spec 016), a pure helper. The zoom is a fraction of the AVAILABLE width of
// the central editing column: 1 (100%) means the page fills the column ("fit to width"),
// smaller values shrink it. It only scales the width the column renders at; it does NOT
// touch the layout engine, so photos stay contain-fit at the new width and nothing is
// cropped.

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 1;
export const ZOOM_STEP = 0.05;
// Default is fit-to-width, so the pages are as large as the space allows out of the box.
export const ZOOM_DEFAULT = 1;

/** Clamp a zoom to the valid range; a non-finite value falls back to the default. */
export function clampZoom(z: number): number {
  if (!Number.isFinite(z)) return ZOOM_DEFAULT;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

/**
 * The central column's rendered width in px for a given available width and zoom (clamped
 * first). At zoom 1 it equals the available width (fills the column); below 1 it is a
 * fraction of it. Never exceeds the available width, so the layout cannot overflow.
 */
export function zoomedWidthPx(availableWidthPx: number, zoom: number): number {
  const avail = Number.isFinite(availableWidthPx) && availableWidthPx > 0 ? availableWidthPx : 0;
  return Math.round(avail * clampZoom(zoom));
}
