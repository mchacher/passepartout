import { cropImgBox } from "../lib/crop";
import { isMask } from "../lib/masks";
import type { CropRect } from "../types";

interface CroppedImgProps {
  url: string;
  name: string;
  crop?: CropRect;
  // Opt-in decorative mask id (spec 018); absent = the plain rectangle. The shape scales to
  // this box via an objectBoundingBox clipPath (see MaskDefs), so it follows the photo size.
  mask?: string;
  // Opt-in decorative tilt in degrees (spec 020); rotates the whole (masked) photo about its
  // center. Not applied when this image is nested inside a FramedPhoto (the frame tilts).
  rotation?: number;
  // The box to fill, in px. The box should already have the photo's EFFECTIVE ratio, so the
  // cropped region fills it undistorted.
  w: number;
  h: number;
  // Classes for the outer frame (rounding / shadow); the image inside just fills it.
  frameClass?: string;
}

// Render a photo into a `w` x `h` box, showing only its crop region (spec 015) and, when a
// mask is set, clipped to that decorative shape (spec 018). With no crop the image fills the
// box exactly; with a crop the image is scaled and offset inside an overflow-hidden frame so
// the kept rectangle fills the box. The image is never distorted (its own aspect is
// preserved; the box carries the effective ratio). A mask only hides pixels outside the
// shape; the frame's rounding / shadow is dropped when a mask reshapes the box.
export function CroppedImg({ url, name, crop, mask, rotation, w, h, frameClass }: CroppedImgProps) {
  const b = cropImgBox(crop, w, h);
  // Only a known catalog id clips; a stale/unknown id falls back to the plain rectangle
  // (symmetric with the print path). See spec 018 edge cases.
  const shape = isMask(mask) ? mask : undefined;
  return (
    <div
      className={`relative block overflow-hidden ${shape ? "" : frameClass ?? ""}`}
      style={{ width: `${w}px`, height: `${h}px`, clipPath: shape ? `url(#pp-mask-${shape})` : undefined, transform: rotation ? `rotate(${rotation}deg)` : undefined }}
    >
      <img
        src={url}
        alt={name}
        draggable={false}
        style={{ position: "absolute", left: `${b.ox}px`, top: `${b.oy}px`, width: `${b.w}px`, height: `${b.h}px`, maxWidth: "none" }}
      />
    </div>
  );
}
