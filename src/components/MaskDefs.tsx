import { MASKS } from "../lib/masks";

// A single hidden SVG holding one clipPath per path-based catalog mask (spec 018). Mounted once
// in App; renderers reference a shape via `maskClipValue(id)`. Using objectBoundingBox units means
// each normalized (0..1) path scales to the clipped element's box, so a mask follows the photo's
// size. Masks that clip via a raw CSS value (`m.clip`, e.g. the true Circle) need no def here.
export function MaskDefs() {
  return (
    <svg width="0" height="0" aria-hidden className="absolute h-0 w-0 overflow-hidden">
      <defs>
        {MASKS.filter((m) => m.path).map((m) => (
          <clipPath key={m.id} id={`pp-mask-${m.id}`} clipPathUnits="objectBoundingBox">
            <path d={m.path} />
          </clipPath>
        ))}
      </defs>
    </svg>
  );
}
