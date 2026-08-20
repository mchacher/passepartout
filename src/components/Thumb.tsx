import { computeLayout, drawOrder, whitespaceToDensity } from "../lib/layout";
import { resolveCells } from "../lib/layouts";
import { bookSizeOrDefault, ratioOf, type BookSizeId } from "../lib/book-sizes";
import { effectiveRatio, cropImgBox } from "../lib/crop";
import { isMask } from "../lib/masks";
import { DEFAULT_CROP_FOCUS, type CellRect, type CropFocus, type CropRect, type PageFill } from "../types";

export interface ThumbPhoto {
  id: string;
  url: string;
  ratio: number;
  crop?: CropRect;
  mask?: string;
}

interface ThumbProps {
  photos: ThumbPhoto[];
  layoutId: string;
  whitespace: number;
  bookSize: BookSizeId;
  /** Full-page mode (spec 012); renders the single photo edge to edge. */
  fullPage?: PageFill;
  /** Crop focus for `cover` full-page mode. */
  focus?: CropFocus;
  /** Custom grid placement (spec 013); overrides the named template when valid. */
  placement?: CellRect[];
}

// A nominal content box the engine lays out in; the result is positioned in percent so
// the thumbnail scales to any pixel width with no DOM measuring.
const NH = 100;

// A faithful miniature of a page or cover. It reuses the pure layout engine at a
// nominal size, so every photo is contain-fit inside its region exactly like the real
// page: nothing is cropped or stretched. The `inset` mirrors the page's content margin.
export function Thumb({ photos, layoutId, whitespace, bookSize, fullPage, focus, placement }: ThumbProps) {
  const aspect = ratioOf(bookSizeOrDefault(bookSize));
  const NW = NH * aspect;
  const gridCells = resolveCells(layoutId, photos.length, placement);
  const { cells } = computeLayout(
    photos.map((p) => ({ ratio: effectiveRatio(p.ratio, p.crop) })),
    NW,
    NH,
    gridCells,
    { density: whitespaceToDensity(whitespace) },
  );
  const order = drawOrder(gridCells);

  // Full-page mode: the single photo fills the whole thumbnail edge to edge, contained
  // (Fit, no crop) or covered (Fill, cropped at the focus). Never distorted.
  if (fullPage && photos.length === 1) {
    const f = focus ?? DEFAULT_CROP_FOCUS;
    return (
      <div
        className="relative overflow-hidden rounded-[2px] bg-paper shadow-[0_1px_2px_rgba(0,0,0,.12)]"
        style={{ aspectRatio: String(aspect) }}
      >
        <img
          src={photos[0].url}
          alt=""
          draggable={false}
          className={`absolute inset-0 h-full w-full ${fullPage === "cover" ? "object-cover" : "object-contain"}`}
          style={fullPage === "cover" ? { objectPosition: `${f.x * 100}% ${f.y * 100}%` } : undefined}
        />
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden rounded-[2px] bg-paper shadow-[0_1px_2px_rgba(0,0,0,.12)]"
      style={{ aspectRatio: String(aspect) }}
    >
      <div className="absolute" style={{ inset: "7%" }}>
        {order.map((i) => {
          const c = cells[i];
          if (!c) return null;
          return (
            <div
              key={photos[i].id}
              className="absolute"
              style={{
                left: `${(c.rx / NW) * 100}%`,
                top: `${(c.ry / NH) * 100}%`,
                width: `${(c.rw / NW) * 100}%`,
                height: `${(c.rh / NH) * 100}%`,
              }}
            >
              <div
                className="absolute overflow-hidden"
                style={{
                  left: `${(c.ox / c.rw) * 100}%`,
                  top: `${(c.oy / c.rh) * 100}%`,
                  width: `${(c.w / c.rw) * 100}%`,
                  height: `${(c.h / c.rh) * 100}%`,
                  clipPath: isMask(photos[i].mask) ? `url(#pp-mask-${photos[i].mask})` : undefined,
                }}
              >
                {(() => {
                  const cb = cropImgBox(photos[i].crop, 100, 100);
                  return (
                    <img
                      src={photos[i].url}
                      alt=""
                      draggable={false}
                      style={{ left: `${cb.ox}%`, top: `${cb.oy}%`, width: `${cb.w}%`, height: `${cb.h}%`, maxWidth: "none" }}
                      className="absolute block"
                    />
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
