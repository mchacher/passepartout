// Decorative photo masks (spec 018), a pure catalog. A mask is an opt-in decorative shape
// that reshapes what is visible inside a photo's box; no mask (the default) shows the plain
// rectangle. The engine never sees a mask.
//
// Three clip mechanisms:
//   - `path`: an SVG path in objectBoundingBox units (0..1), clipped via `url(#pp-mask-<id>)`
//     (see MaskDefs). It scales to the box, so a normalized "circle" path becomes an oval on a
//     non-square photo (the Oval mask relies on exactly this).
//   - `clip`: a raw CSS clip-path value, for shapes that must stay aspect-independent. The true
//     Circle uses `circle(closest-side)` so it stays a real circle whatever the photo's ratio
//     (issue #41), which an objectBoundingBox path cannot do.
//   - `rounded`: the size-parameterized rounded rectangle (spec 034). Its clip is computed per
//     box from a per-photo radius (a fraction of the SHORTER side) so the corners are a constant
//     circular radius that does not follow the photo's aspect. Resolved by `maskClipValue`.
// Renderers call `maskClipValue(id, ctx)` and never build the clip themselves.
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
  /** The size-parameterized rounded rectangle: its clip is computed per box (spec 034). */
  rounded?: boolean;
}

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
  {
    id: "rounded",
    name: "Rounded",
    // A rounded rectangle with a constant, circular corner radius chosen from a size sub-control
    // (spec 034); the clip is computed per box in `maskClipValue`, so corners never stretch.
    rounded: true,
  },
  {
    id: "arch",
    name: "Arch",
    // Rectangle with a semicircular top (a window arch).
    path: "M0,1 L0,0.5 A0.5,0.5 0 0 1 1,0.5 L1,1 Z",
  },
];

// Rounded-corner sizes (spec 034): the corner radius as a fraction of the box's SHORTER side, so
// the same size reads identically on a portrait and a landscape photo. Mirrors BORDER_WIDTHS.
export const ROUNDED_SIZES: { id: string; label: string; value: number }[] = [
  { id: "sm", label: "Subtle", value: 0.08 },
  { id: "md", label: "Medium", value: 0.16 },
  { id: "lg", label: "Strong", value: 0.28 },
];
export const DEFAULT_ROUNDED_SIZE = ROUNDED_SIZES[1].value;

/** Clamp a stored rounded radius to a valid fraction of the shorter side, or the default when absent. */
export function roundedRadiusOf(r: number | undefined): number {
  if (typeof r !== "number" || !Number.isFinite(r)) return DEFAULT_ROUNDED_SIZE;
  return Math.max(0.02, Math.min(0.5, r));
}

/** Look up a mask by id (undefined for an absent or unknown id). */
export function maskById(id: string | undefined): MaskShape | undefined {
  return id ? MASKS.find((m) => m.id === id) : undefined;
}

/** True when id names a catalog mask. */
export function isMask(id: string | undefined): boolean {
  return maskById(id) !== undefined;
}

/** Context a renderer passes so a box-dependent mask (the rounded rectangle) can be resolved. */
export interface MaskClipCtx {
  w?: number;
  h?: number;
  radius?: number; // the photo's maskRadius (fraction of the shorter side); rounded mask only
}

/**
 * The CSS `clip-path` value for a mask id. Circle is a raw CSS function; oval and arch reference
 * the shared SVG clipPath (`url(#pp-mask-<id>)`); the rounded mask is computed from the box so its
 * corners are a constant circular radius (`inset(0 round Rpx)`, R = radius x min(w, h)), which does
 * not follow the photo's aspect (spec 034). Undefined for an absent/unknown id (plain rectangle).
 * The single place the clip is resolved, used by every renderer.
 */
export function maskClipValue(id: string | undefined, ctx: MaskClipCtx = {}): string | undefined {
  const m = maskById(id);
  if (!m) return undefined;
  if (m.rounded) {
    const w = ctx.w ?? 0;
    const h = ctx.h ?? 0;
    const short = Math.min(w, h);
    if (short <= 0) return undefined; // no box yet; nothing to clip
    return `inset(0 round ${roundedRadiusOf(ctx.radius) * short}px)`;
  }
  return m.clip ?? `url(#pp-mask-${m.id})`;
}

/**
 * A mask resolved to plain geometry, in the box's own units, for a renderer that cannot use a
 * CSS `clip-path`: the PDF export paints its photos on a canvas and clips them with a `Path2D`
 * (issue #121). It used to read `shape.path` directly, which is undefined for the two
 * mechanisms added later, so the clip kept nothing and a Circle or Rounded photo was exported
 * as a fully transparent image. Going through this function instead means a new mechanism has
 * to be answered here, and the catalog test below fails until it is.
 */
export type MaskGeometry =
  | { kind: "path"; d: string } // objectBoundingBox path, to be scaled by the box
  | { kind: "circle"; cx: number; cy: number; r: number }
  | { kind: "roundRect"; w: number; h: number; r: number };

// The canvas equivalent of a raw CSS clip value. One entry per `clip` mask in the catalog.
const CSS_GEOMETRY: Record<string, (w: number, h: number) => MaskGeometry> = {
  "circle(closest-side)": (w, h) => ({ kind: "circle", cx: w / 2, cy: h / 2, r: Math.min(w, h) / 2 }),
};

/**
 * The geometry of a mask for a box of `w` x `h`, or undefined when there is nothing to clip:
 * an absent or unknown id, a box with no size yet, or a CSS clip nobody has translated. A
 * renderer must then draw the plain photo. Never clipping is the safe failure here; clipping
 * with an empty path removes the photo altogether, which is the bug this replaces.
 */
export function maskGeometry(id: string | undefined, ctx: MaskClipCtx = {}): MaskGeometry | undefined {
  const m = maskById(id);
  if (!m) return undefined;
  if (m.path) return { kind: "path", d: m.path };
  const w = ctx.w ?? 0;
  const h = ctx.h ?? 0;
  if (w <= 0 || h <= 0) return undefined;
  if (m.rounded) return { kind: "roundRect", w, h, r: roundedRadiusOf(ctx.radius) * Math.min(w, h) };
  return m.clip ? CSS_GEOMETRY[m.clip]?.(w, h) : undefined;
}
