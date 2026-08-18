import { computeLayout, whitespaceToDensity } from "../lib/layout";
import { resolveNode } from "../lib/layouts";
import { bookSizeOrDefault, ratioOf, type BookSizeId } from "../lib/book-sizes";

export interface ThumbPhoto {
  id: string;
  url: string;
  ratio: number;
}

interface ThumbProps {
  photos: ThumbPhoto[];
  layoutId: string;
  whitespace: number;
  bookSize: BookSizeId;
}

// A nominal content box the engine lays out in; the result is positioned in percent so
// the thumbnail scales to any pixel width with no DOM measuring.
const NH = 100;

// A faithful miniature of a page or cover. It reuses the pure layout engine at a
// nominal size, so every photo is contain-fit inside its region exactly like the real
// page: nothing is cropped or stretched. The `inset` mirrors the page's content margin.
export function Thumb({ photos, layoutId, whitespace, bookSize }: ThumbProps) {
  const aspect = ratioOf(bookSizeOrDefault(bookSize));
  const NW = NH * aspect;
  const node = resolveNode(layoutId, photos.length);
  const { cells } = computeLayout(
    photos.map((p) => ({ ratio: p.ratio })),
    NW,
    NH,
    node,
    { density: whitespaceToDensity(whitespace) },
  );

  return (
    <div
      className="relative overflow-hidden rounded-[2px] bg-paper shadow-[0_1px_2px_rgba(0,0,0,.12)]"
      style={{ aspectRatio: String(aspect) }}
    >
      <div className="absolute" style={{ inset: "7%" }}>
        {cells.map((c, i) => (
          <div
            key={photos[i].id}
            className="absolute flex items-center justify-center"
            style={{
              left: `${(c.rx / NW) * 100}%`,
              top: `${(c.ry / NH) * 100}%`,
              width: `${(c.rw / NW) * 100}%`,
              height: `${(c.rh / NH) * 100}%`,
            }}
          >
            <img
              src={photos[i].url}
              alt=""
              draggable={false}
              style={{ width: `${(c.w / c.rw) * 100}%`, height: `${(c.h / c.rh) * 100}%` }}
              className="block"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
