// Decorative photo rotation (spec 020), a pure helper. A rotation is a small whole-photo
// tilt in fixed steps; it never crops or changes the aspect ratio (it is applied as a
// visual transform on top of the layout the engine already chose). The engine never sees it.

// The decorative range: tilts beyond this stop looking like a dropped-photo tilt.
export const ROTATION_MAX = 30;
// The increments offered in the UI.
export const ROTATION_STEPS = [5, 10] as const;

/** Clamp a tilt to the decorative range; a non-finite value is level (0). */
export function clampRotation(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  return Math.max(-ROTATION_MAX, Math.min(ROTATION_MAX, deg));
}
