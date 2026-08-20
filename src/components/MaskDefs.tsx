import { MASKS } from "../lib/masks";

// A single hidden SVG holding one clipPath per catalog mask (spec 018). Mounted once in
// App; CroppedImg references a shape with `clip-path: url(#pp-mask-<id>)`. Using
// objectBoundingBox units means each normalized (0..1) path scales to the clipped
// element's box, so a mask follows the photo's size.
export function MaskDefs() {
  return (
    <svg width="0" height="0" aria-hidden className="absolute h-0 w-0 overflow-hidden">
      <defs>
        {MASKS.map((m) => (
          <clipPath key={m.id} id={`pp-mask-${m.id}`} clipPathUnits="objectBoundingBox">
            <path d={m.path} />
          </clipPath>
        ))}
      </defs>
    </svg>
  );
}
