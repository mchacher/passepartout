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

// "Fit" (100%) leaves a small margin rather than touching the column edges, so the pages
// have a little breathing room. The fit width is this fraction of the column content width.
export const FIT_MARGIN = 0.1;

/** Clamp a zoom to the valid range; a non-finite value falls back to the default. */
export function clampZoom(z: number): number {
  if (!Number.isFinite(z)) return ZOOM_DEFAULT;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

/**
 * The width the column fills at 100% zoom ("Fit"): the content width less the fit margin,
 * so the pages do not touch the edges. A non-positive / invalid content width is 0.
 */
export function fitWidthPx(contentWidthPx: number): number {
  const c = Number.isFinite(contentWidthPx) && contentWidthPx > 0 ? contentWidthPx : 0;
  return Math.round(c * (1 - FIT_MARGIN));
}

/**
 * The central column's rendered width in px for a given fit width (the 100% width, see
 * `fitWidthPx`) and zoom (clamped first). At zoom 1 it equals the fit width; below 1 it is
 * a fraction of it. Never exceeds the fit width, so the layout cannot overflow.
 */
export function zoomedWidthPx(fitWidthPx: number, zoom: number): number {
  const fit = Number.isFinite(fitWidthPx) && fitWidthPx > 0 ? fitWidthPx : 0;
  return Math.round(fit * clampZoom(zoom));
}
