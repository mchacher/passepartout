// Decorative photo masks (spec 018), a pure catalog. A mask is an opt-in decorative shape
// that reshapes what is visible inside a photo's box; no mask (the default) shows the plain
// rectangle. Each shape is an SVG path in normalized objectBoundingBox units (every
// coordinate in 0..1), so it scales to any box and follows the photo's size: a "circle"
// naturally becomes an oval on a non-square photo. The engine never sees a mask.
//
// EVOLUTIVE: to add a shape, append one entry here (id + name + normalized path). Nothing
// else changes: the picker, the renderers and the print painter all read this list.

export interface MaskShape {
  id: string;
  name: string;
  /** SVG path in objectBoundingBox units (0..1), traced clockwise. */
  path: string;
}

// r = corner radius (rounded), in box fractions. Kept here so the paths stay readable.
const RR = 0.14;

export const MASKS: MaskShape[] = [
  {
    id: "oval",
    name: "Oval",
    // Full ellipse filling the box (two half-arcs). Fills a landscape box as a wide oval.
    path: "M0,0.5 A0.5,0.5 0 0 1 1,0.5 A0.5,0.5 0 0 1 0,0.5 Z",
  },
  {
    id: "rounded",
    name: "Rounded",
    // Rounded rectangle; corners are quarter curves (elliptical, since x/y scale apart).
    path: `M${RR},0 L${1 - RR},0 Q1,0 1,${RR} L1,${1 - RR} Q1,1 ${1 - RR},1 L${RR},1 Q0,1 0,${1 - RR} L0,${RR} Q0,0 ${RR},0 Z`,
  },
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
