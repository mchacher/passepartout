import { CroppedImg } from "./CroppedImg";
import { frameById, frameColorOf, frameInner, squareCrop, borderWidthOf } from "../lib/frames";
import { DEFAULT_CROP_FOCUS, type CropFocus, type CropRect } from "../types";

const FALLBACK_FRAME = "rounded-[1px] shadow-[0_1px_3px_rgba(0,0,0,.14)]";

interface FramedPhotoProps {
  url: string;
  name: string;
  crop?: CropRect;
  mask?: string;
  // The photo's EFFECTIVE ratio (crop applied), used to contain it inside a Border.
  ratio: number;
  // The photo's NATIVE ratio, used to square it for a Polaroid window.
  sourceRatio: number;
  frame: string;
  color?: string;
  text?: string;
  width?: number;
  focus?: CropFocus;
  // Decorative tilt in degrees (spec 020); rotates the whole framed unit about its center.
  rotation?: number;
  // The frame box in px (the cell the engine chose for the frame's outer ratio).
  w: number;
  h: number;
}

// A decorative frame (spec 019). Border mats the contained photo in a uniform border (never
// clips). Polaroid shows the photo in a square window (cover-cropped at a pannable focus)
// over a bottom band that holds an optional handwritten note. No rounded corners. Falls back
// to a plain contained photo if the frame id is unknown.
export function FramedPhoto({ url, name, crop, mask, ratio, sourceRatio, frame, color, text, width, focus, rotation, w, h }: FramedPhotoProps) {
  const style = frameById(frame);
  if (!style) return <CroppedImg url={url} name={name} crop={crop} mask={mask} rotation={rotation} w={w} h={h} frameClass={FALLBACK_FRAME} />;

  const c = frameColorOf(color, style.defaultColor);
  const inner = frameInner(style, w, h, borderWidthOf(width));

  let photo: React.ReactNode;
  if (style.square) {
    // Polaroid: the square window shows a pixel-square region of the source at the focus.
    const sq = squareCrop(sourceRatio, focus ?? DEFAULT_CROP_FOCUS);
    photo = (
      <div className="absolute" style={{ left: `${inner.x}px`, top: `${inner.y}px` }}>
        <CroppedImg url={url} name={name} crop={sq} mask={mask} w={inner.w} h={inner.h} />
      </div>
    );
  } else {
    // Border: contain the photo (its effective ratio) inside the inner area, centered.
    const pw = inner.w / inner.h > ratio ? inner.h * ratio : inner.w;
    const ph = inner.w / inner.h > ratio ? inner.h : inner.w / ratio;
    photo = (
      <div className="absolute" style={{ left: `${inner.x + (inner.w - pw) / 2}px`, top: `${inner.y + (inner.h - ph) / 2}px` }}>
        <CroppedImg url={url} name={name} crop={crop} mask={mask} w={pw} h={ph} />
      </div>
    );
  }

  const bandTop = inner.y + inner.h;
  const bandH = h - bandTop;
  const showNote = style.hasText && !!text && text.trim().length > 0;

  return (
    <div className="relative" style={{ width: `${w}px`, height: `${h}px`, background: c.value, boxShadow: "0 2px 12px rgba(0,0,0,0.18)", transform: rotation ? `rotate(${rotation}deg)` : undefined }}>
      {photo}
      {showNote && (
        <div
          className="font-hand absolute flex items-center justify-center overflow-hidden text-center leading-none"
          style={{ left: `${inner.x}px`, top: `${bandTop}px`, width: `${inner.w}px`, height: `${bandH}px`, color: c.ink, fontSize: `${Math.min(bandH * 0.5, w * 0.08)}px` }}
        >
          <span className="max-w-full truncate px-[4%]">{text!.trim()}</span>
        </div>
      )}
    </div>
  );
}
