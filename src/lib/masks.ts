// Decorative photo masks (spec 018), a pure catalog. A mask is an opt-in decorative shape
// that reshapes what is visible inside a photo's box; no mask (the default) shows the plain
// rectangle. The engine never sees a mask.
//
// Two clip mechanisms:
//   - `path`: an SVG path in objectBoundingBox units (0..1), clipped via `url(#pp-mask-<id>)`
//     (see MaskDefs). It scales to the box, so a normalized "circle" path becomes an oval on a
//     non-square photo (the Oval mask relies on exactly this).
//   - `clip`: a raw CSS clip-path value, for shapes that must stay aspect-independent. The true
//     Circle uses `circle(closest-side)` so it stays a real circle whatever the photo's ratio
//     (issue #41), which an objectBoundingBox path cannot do.
// A mask carries exactly one of the two. Renderers call `maskClipValue(id)` and never build the
// clip themselves.
//
// EVOLUTIVE: to add a shape, append one entry here (id + name + `path` OR `clip`). Nothing else
// changes: the picker and the on-screen renderers read this list.

export interface MaskShape {
  id: string;
  name: string;
  /** SVG path in objectBoundingBox units (0..1), traced clockwise. Clipped via `url(#pp-mask-id)`. */
  path?: string;
  /** Raw CSS clip-path value, used verbatim (aspect-independent shapes like a true circle). */
  clip?: string;
}

// Rounded-rectangle path for a corner radius `r` (in box fractions). Corners are quarter curves
// (elliptical on a non-square box, since x/y scale apart).
const roundedRect = (r: number) =>
  `M${r},0 L${1 - r},0 Q1,0 1,${r} L1,${1 - r} Q1,1 ${1 - r},1 L${r},1 Q0,1 0,${1 - r} L0,${r} Q0,0 ${r},0 Z`;

export const MASKS: MaskShape[] = [
  {
    id: "circle",
    name: "Circle",
    // True inscribed circle, centered, whatever the photo's aspect ratio (issue #41).
    clip: "circle(closest-side)",
  },
  {
    id: "oval",
    name: "Oval",
    // Full ellipse filling the box (two half-arcs). Fills a landscape box as a wide oval.
    path: "M0,0.5 A0.5,0.5 0 0 1 1,0.5 A0.5,0.5 0 0 1 0,0.5 Z",
  },
  // Three rounded-corner sizes (issue #40): the previous single radius (0.14) was far too strong,
  // so the default (kept under the stable id "rounded") is now the gentle middle, with a lighter
  // and a stronger option on either side.
  { id: "rounded-sm", name: "Rounded (subtle)", path: roundedRect(0.05) },
  { id: "rounded", name: "Rounded", path: roundedRect(0.09) },
  { id: "rounded-lg", name: "Rounded (strong)", path: roundedRect(0.14) },
  {
    id: "arch",
    name: "Arch",
    // Rectangle with a semicircular top (a window arch).
    path: "M0,1 L0,0.5 A0.5,0.5 0 0 1 1,0.5 L1,1 Z",
  },
];

/** Look up a mask by id (undefined for an absent or unknown id). */
export function maskById(id: string | undefined): MaskShape | undefined {
  return id ? MASKS.find((m) => m.id === id) : undefined;
}

/** True when id names a catalog mask. */
export function isMask(id: string | undefined): boolean {
  return maskById(id) !== undefined;
}

/**
 * The CSS `clip-path` value for a mask id: a raw CSS function (aspect-independent shapes) or a
 * reference to the shared SVG clipPath (`url(#pp-mask-<id>)`). Undefined for an absent/unknown id
 * (the plain rectangle). The single place the clip is resolved, used by every renderer.
 */
export function maskClipValue(id: string | undefined): string | undefined {
  const m = maskById(id);
  if (!m) return undefined;
  return m.clip ?? `url(#pp-mask-${m.id})`;
}
