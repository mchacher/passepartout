import { cropImgBox } from "../lib/crop";
import type { CropRect } from "../types";

interface CroppedImgProps {
  url: string;
  name: string;
  crop?: CropRect;
  // The box to fill, in px. The box should already have the photo's EFFECTIVE ratio, so the
  // cropped region fills it undistorted.
  w: number;
  h: number;
  // Classes for the outer frame (rounding / shadow); the image inside just fills it.
  frameClass?: string;
}

// Render a photo into a `w` x `h` box, showing only its crop region (spec 015). With no
// crop the image fills the box exactly (a plain image); with a crop the image is scaled and
// offset inside an overflow-hidden frame so the kept rectangle fills the box. The image is
// never distorted (its own aspect is preserved; the box carries the effective ratio).
export function CroppedImg({ url, name, crop, w, h, frameClass }: CroppedImgProps) {
  const b = cropImgBox(crop, w, h);
  return (
    <div className={`relative block overflow-hidden ${frameClass ?? ""}`} style={{ width: `${w}px`, height: `${h}px` }}>
      <img
        src={url}
        alt={name}
        draggable={false}
        style={{ position: "absolute", left: `${b.ox}px`, top: `${b.oy}px`, width: `${b.w}px`, height: `${b.h}px`, maxWidth: "none" }}
      />
    </div>
  );
}
