import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { computeLayout, whitespaceToDensity } from "../lib/layout";
import { resolveCells } from "../lib/layouts";
import { bookSizeOrDefault, ratioOf, type BookSizeId } from "../lib/book-sizes";
import { DEFAULT_CROP_FOCUS, type CellRect, type CropFocus, type PageFill } from "../types";

// A read-only, faithful render of one book leaf (a page or a cover face) at an exact
// pixel width, for the in-app book preview (spec 011). It reuses the pure layout engine
// with the SAME margins, header offsets and text-scale formulas as Paper/CoverCard, so a
// preview leaf matches what the editor and the PDF produce. Every photo is contain-fit:
// nothing is cropped or distorted. There is no editing here (no DnD, no controls).

export interface PreviewPhoto {
  id: string;
  url: string;
  ratio: number;
  caption: string;
}

// Page margins mirror Paper.tsx / print.ts (percentages of the page width).
const MARGIN = 0.05;
const TOP_TITLE = 0.11;
const TOP_SUBTITLE = 0.14;

interface PagePreviewProps {
  kind: "page";
  pageW: number;
  bookSize: BookSizeId;
  title: string;
  subtitle: string;
  layoutId: string;
  whitespace: number;
  photos: PreviewPhoto[];
  fullPage?: PageFill;
  focus?: CropFocus;
  placement?: CellRect[];
}

interface CoverPreviewProps {
  kind: "cover";
  pageW: number;
  bookSize: BookSizeId;
  title: string;
  subtitle: string;
  whitespace: number;
  photo: PreviewPhoto | null;
}

export type PreviewPaperProps = PagePreviewProps | CoverPreviewProps;

export function PreviewPaper(props: PreviewPaperProps) {
  const aspect = ratioOf(bookSizeOrDefault(props.bookSize));
  const pageH = props.pageW / aspect;

  return (
    <div
      className="relative overflow-hidden bg-paper"
      style={{ width: props.pageW, height: pageH, containerType: "inline-size" }}
    >
      {props.kind === "page" ? <PageLeaf {...props} w={props.pageW} h={pageH} /> : <CoverLeaf {...props} w={props.pageW} h={pageH} />}
    </div>
  );
}

// A content page: title/subtitle header, photos placed by the engine, per-photo
// captions. Blank when the page has no photos (a faithful blank printed page).
function PageLeaf({ title, subtitle, layoutId, whitespace, photos, fullPage, focus, placement, w, h }: PagePreviewProps & { w: number; h: number }) {
  // Full-page mode (spec 012): the single photo fills the page edge to edge, contained
  // (Fit) or covered (Fill, cropped at the focus). No header/captions. Never distorted.
  if (fullPage && photos.length === 1) {
    const f = focus ?? DEFAULT_CROP_FOCUS;
    return (
      <img
        src={photos[0].url}
        alt=""
        draggable={false}
        className={`absolute inset-0 h-full w-full ${fullPage === "cover" ? "object-cover" : "object-contain"}`}
        style={fullPage === "cover" ? { objectPosition: `${f.x * 100}% ${f.y * 100}%` } : undefined}
      />
    );
  }

  const hasTitle = title.trim().length > 0;
  const hasSubtitle = subtitle.trim().length > 0;
  const hasHeader = hasTitle || hasSubtitle;

  // Content box in px, identical to Paper's padding model (percentages of width).
  const padX = MARGIN * w;
  const padTop = (hasSubtitle ? TOP_SUBTITLE : hasTitle ? TOP_TITLE : MARGIN) * w;
  const padBottom = MARGIN * w;
  const contentW = w - 2 * padX;
  const contentH = h - padTop - padBottom;

  const { cells } = computeLayout(
    photos.map((p) => ({ ratio: p.ratio })),
    contentW,
    contentH,
    resolveCells(layoutId, photos.length, placement),
    { density: whitespaceToDensity(whitespace) },
  );

  return (
    <>
      {hasHeader && (
        <div className="pointer-events-none absolute inset-x-[7%] top-[5.4%] z-10 text-center">
          {hasTitle && (
            <div
              className="font-album tracking-wide"
              style={{ fontSize: "calc(clamp(13px, 3.1cqw, 19px) * var(--page-title-scale))", color: "var(--album-ink)" }}
            >
              {title.trim()}
            </div>
          )}
          {hasSubtitle && (
            <div
              className="mt-[1%] font-album"
              style={{ fontSize: "calc(clamp(10px, 2.2cqw, 14px) * var(--page-subtitle-scale))", color: "var(--album-ink-soft)" }}
            >
              {subtitle.trim()}
            </div>
          )}
        </div>
      )}

      <div className="absolute" style={{ left: padX, top: padTop, width: contentW, height: contentH }}>
        <div className="relative h-full w-full">
          {cells.map((cell, i) => {
            const photo = photos[i];
            return (
              <div
                key={photo.id}
                className="absolute flex flex-col items-center justify-center"
                style={{ left: cell.rx, top: cell.ry, width: cell.rw, height: cell.rh }}
              >
                <div className="flex flex-col items-center gap-[5px]">
                  <img
                    src={photo.url}
                    alt=""
                    draggable={false}
                    style={{ width: `${cell.w}px`, height: `${cell.h}px` }}
                    className="block rounded-[1px] shadow-[0_1px_3px_rgba(0,0,0,.14)]"
                  />
                  {photo.caption.trim().length > 0 && (
                    <div
                      className="max-w-full break-words text-center font-album leading-tight"
                      style={{ width: `${cell.w}px`, fontSize: "calc(10.5px * var(--caption-scale))", color: "var(--album-ink-soft)" }}
                    >
                      {photo.caption.trim()}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// A cover face: title/subtitle at the top, one optional contained photo below. It
// mirrors CoverCard exactly (same flex flow and 9% paddings) and measures the photo band
// with a ResizeObserver, so the contained photo matches the editor to the pixel rather
// than relying on an analytic header-height estimate.
function CoverLeaf({ title, subtitle, whitespace, photo, h }: CoverPreviewProps & { w: number; h: number }) {
  const hasTitle = title.trim().length > 0;
  const hasSubtitle = subtitle.trim().length > 0;
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);

  const measure = useCallback(() => {
    const el = boxRef.current;
    if (!el || !photo) {
      setBox(null);
      return;
    }
    const cs = getComputedStyle(el);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const cw = el.clientWidth - padX;
    const ch = el.clientHeight - padY;
    const { cells } = computeLayout([{ ratio: photo.ratio }], cw, ch, resolveCells("single", 1), {
      density: whitespaceToDensity(whitespace),
    });
    const c = cells[0];
    setBox(c ? { w: c.w, h: c.h } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo?.id, photo?.ratio, whitespace, h]);

  useLayoutEffect(() => {
    measure();
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <div className="flex h-full w-full flex-col">
      <div className="z-10 px-[9%] pt-[9%] text-center">
        {hasTitle && (
          <div
            className="font-album tracking-wide"
            style={{ fontSize: "calc(clamp(16px, 5cqw, 34px) * var(--cover-title-scale))", color: "var(--album-ink)" }}
          >
            {title.trim()}
          </div>
        )}
        {hasSubtitle && (
          <div
            className="mt-[2%] font-album"
            style={{ fontSize: "calc(clamp(11px, 2.6cqw, 16px) * var(--cover-subtitle-scale))", color: "var(--album-ink-soft)" }}
          >
            {subtitle.trim()}
          </div>
        )}
      </div>

      <div ref={boxRef} className="relative flex min-h-0 flex-1 items-center justify-center p-[9%]">
        {photo && box && (
          <img
            src={photo.url}
            alt=""
            draggable={false}
            style={{ width: `${box.w}px`, height: `${box.h}px` }}
            className="block rounded-[1px] shadow-[0_1px_3px_rgba(0,0,0,.14)]"
          />
        )}
      </div>
    </div>
  );
}
