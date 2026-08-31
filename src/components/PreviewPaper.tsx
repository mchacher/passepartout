import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { computeLayout, drawOrder, PAGE_V_ALIGN, whitespaceToDensity } from "../lib/layout";
import { resolveCells } from "../lib/layouts";
import { bookSizeOrDefault, ratioOf, type BookSizeId } from "../lib/book-sizes";
import { effectiveRatio } from "../lib/crop";
import { photoLayoutRatio } from "../lib/frames";
import {
  F_COVER_SUBTITLE,
  F_COVER_TITLE,
  F_CAPTION,
  F_CAPTION_GAP,
  F_PAGE_SUBTITLE,
  F_PAGE_TITLE,
  HEADER_TOP,
  LINE,
  PAGE_MARGIN,
  headerFontCss,
  headerFontSize,
  headerGeometry,
  pageFracCss,
} from "../lib/page-header";
import { SIZE_SCALE } from "../lib/text-sizes";
import { COVER_MARGIN_CSS, coverBandCss } from "../lib/cover-layout";
import { useAlbum } from "../store";
import { CroppedImg } from "./CroppedImg";
import { FramedPhoto } from "./FramedPhoto";
import { DEFAULT_CROP_FOCUS, type CellRect, type CropFocus, type CropRect,
  type CoverTextPosition, type Note, type PageFill } from "../types";
import { NoteLayer } from "./NoteLayer";

// A read-only, faithful render of one book leaf (a page or a cover face) at an exact
// pixel width, for the in-app book preview (spec 011). It reuses the pure layout engine
// with the SAME margins, header offsets and text-scale formulas as Paper/CoverCard, so a
// preview leaf matches what the editor and the PDF produce. The leaf content arrives as
// props; the album-wide text sizes are read from the store, like every other consumer of
// the header geometry (spec 036). Every photo is contain-fit:
// nothing is cropped or distorted. There is no editing here (no DnD, no controls).

export interface PreviewPhoto {
  id: string;
  url: string;
  ratio: number;
  caption: string;
  crop?: CropRect;
  mask?: string;
  maskRadius?: number;
  frame?: string;
  frameColor?: string;
  frameText?: string;
  frameWidth?: number;
  frameFocus?: CropFocus;
  rotation?: number;
}

// Page margins and the header band come from src/lib/page-header.ts, the one rule Paper and
// print.ts render from too (spec 036).
const MARGIN = PAGE_MARGIN;

interface PagePreviewProps {
  kind: "page";
  /** Notes placed on this leaf (spec 039); read only here, like everything else. */
  notes?: Note[];
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
  notes?: Note[];
  pageW: number;
  bookSize: BookSizeId;
  title: string;
  subtitle: string;
  whitespace: number;
  photo: PreviewPhoto | null;
  /** Which side of the photo the text sits on (spec 042); absent = above it. */
  textPosition?: CoverTextPosition;
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
      {/* Notes sit over whatever the leaf holds (spec 039), read only in the preview. */}
      <NoteLayer notes={props.notes} boxW={props.pageW} boxH={pageH} />
    </div>
  );
}

// A content page: title/subtitle header, photos placed by the engine, per-photo
// captions. Blank when the page has no photos (a faithful blank printed page).
function PageLeaf({ title, subtitle, layoutId, whitespace, photos, fullPage, focus, placement, w, h }: PagePreviewProps & { w: number; h: number }) {
  const textSizes = useAlbum((s) => s.textSizes);
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

  // Content box in px, from the same header geometry as the editor and the PDF: the sizes are
  // the pure fraction of the page width the CSS below uses too (spec 036).
  const titlePx = hasTitle ? headerFontSize(F_PAGE_TITLE, w, SIZE_SCALE[textSizes.pageTitle]) : 0;
  const subtitlePx = hasSubtitle
    ? headerFontSize(F_PAGE_SUBTITLE, w, SIZE_SCALE[textSizes.pageSubtitle])
    : 0;
  const header = headerGeometry({ titleSize: titlePx, subtitleSize: subtitlePx, pageW: w, pageH: h });
  const padX = MARGIN * w;
  const padTop = header.band; // already the plain margin when the leaf has no text
  const padBottom = MARGIN * w;
  const contentW = w - 2 * padX;
  const contentH = h - padTop - padBottom;

  const gridCells = resolveCells(layoutId, photos.length, placement);
  const { cells } = computeLayout(
    photos.map((p) => ({ ratio: photoLayoutRatio(p) })),
    contentW,
    contentH,
    gridCells,
    { density: whitespaceToDensity(whitespace), vAlign: PAGE_V_ALIGN },
  );
  const order = drawOrder(gridCells);

  return (
    <>
      {hasHeader && (
        <div
          className="pointer-events-none absolute inset-x-[7%] z-10 text-center"
          style={{ top: `${HEADER_TOP * 100}%`, lineHeight: LINE }}
        >
          {hasTitle && (
            <div
              className="font-album tracking-wide"
              style={{
                fontSize: headerFontCss(F_PAGE_TITLE, "--page-title-scale"),
                color: "var(--album-ink)",
              }}
            >
              {title.trim()}
            </div>
          )}
          {hasSubtitle && (
            <div
              className="font-album"
              style={{
                marginTop: header.gap,
                fontSize: headerFontCss(F_PAGE_SUBTITLE, "--page-subtitle-scale"),
                color: "var(--album-ink-soft)",
              }}
            >
              {subtitle.trim()}
            </div>
          )}
        </div>
      )}

      <div className="absolute" style={{ left: padX, top: padTop, width: contentW, height: contentH }}>
        <div className="relative h-full w-full">
          {order.map((i) => {
            const cell = cells[i];
            const photo = photos[i];
            if (!cell) return null;
            return (
              <div
                key={photo.id}
                className="absolute"
                style={{ left: cell.rx, top: cell.ry, width: cell.rw, height: cell.rh }}
              >
                <div
                  className="absolute flex flex-col items-center"
                  style={{
                    gap: pageFracCss(F_CAPTION_GAP),
                    left: cell.ox,
                    top: cell.oy,
                    width: cell.w,
                    transform: photo.rotation ? `rotate(${photo.rotation}deg)` : undefined,
                    transformOrigin: `center ${cell.h / 2}px`,
                  }}
                >
                  {photo.frame ? (
                    <FramedPhoto url={photo.url} name="" crop={photo.crop} mask={photo.mask} maskRadius={photo.maskRadius} ratio={effectiveRatio(photo.ratio, photo.crop)} sourceRatio={photo.ratio} frame={photo.frame} color={photo.frameColor} text={photo.frameText} width={photo.frameWidth} focus={photo.frameFocus} w={cell.w} h={cell.h} />
                  ) : (
                    <CroppedImg url={photo.url} name="" crop={photo.crop} mask={photo.mask} maskRadius={photo.maskRadius} w={cell.w} h={cell.h} frameClass="rounded-[1px] shadow-[0_1px_3px_rgba(0,0,0,.14)]" />
                  )}
                  {photo.caption.trim().length > 0 && (
                    <div
                      className="max-w-full break-words text-center font-album leading-tight"
                      style={{ width: `${cell.w}px`, fontSize: headerFontCss(F_CAPTION, "--caption-scale"), color: "var(--album-ink-soft)" }}
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
function CoverLeaf({ title, subtitle, whitespace, photo, textPosition, h }: CoverPreviewProps & { w: number; h: number }) {
  const hasTitle = title.trim().length > 0;
  const hasSubtitle = subtitle.trim().length > 0;
  // The header sits in a fixed band, above the photo or under it (spec 042). Band and margin
  // come from cover-layout.ts, the module CoverCard and print.ts read, so the preview cannot
  // drift from either.
  const band = coverBandCss({ hasTitle, hasSubtitle });
  const margin = COVER_MARGIN_CSS;
  const atBottom = textPosition === "bottom";
  const textBox = {
    top: atBottom ? undefined : 0,
    bottom: atBottom ? 0 : undefined,
    paddingLeft: margin,
    paddingRight: margin,
    paddingTop: atBottom ? undefined : margin,
    paddingBottom: atBottom ? margin : undefined,
  };
  const photoBox = {
    top: atBottom ? 0 : band,
    bottom: atBottom ? band : 0,
    paddingLeft: margin,
    paddingRight: margin,
    paddingTop: atBottom ? margin : undefined,
    paddingBottom: atBottom ? undefined : margin,
  };
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
    const { cells } = computeLayout([{ ratio: photoLayoutRatio(photo) }], cw, ch, resolveCells("single", 1), {
      density: whitespaceToDensity(whitespace),
    });
    const c = cells[0];
    setBox(c ? { w: c.w, h: c.h } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo?.id, photo?.ratio, photo?.crop, photo?.frame, photo?.frameWidth, photo?.mask, whitespace, h, band, atBottom]);

  useLayoutEffect(() => {
    measure();
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-x-0 z-10 text-center" style={textBox}>
        {hasTitle && (
          <div
            className="font-album tracking-wide"
            style={{ fontSize: headerFontCss(F_COVER_TITLE, "--cover-title-scale"), color: "var(--album-ink)" }}
          >
            {title.trim()}
          </div>
        )}
        {hasSubtitle && (
          <div
            className="mt-[2%] font-album"
            style={{ fontSize: headerFontCss(F_COVER_SUBTITLE, "--cover-subtitle-scale"), color: "var(--album-ink-soft)" }}
          >
            {subtitle.trim()}
          </div>
        )}
      </div>

      <div
        ref={boxRef}
        className="absolute inset-x-0 flex items-center justify-center"
        style={photoBox}
      >
        {photo && box &&
          (photo.frame ? (
            <FramedPhoto url={photo.url} name="" crop={photo.crop} mask={photo.mask} maskRadius={photo.maskRadius} ratio={effectiveRatio(photo.ratio, photo.crop)} sourceRatio={photo.ratio} frame={photo.frame} color={photo.frameColor} text={photo.frameText} width={photo.frameWidth} focus={photo.frameFocus} w={box.w} h={box.h} />
          ) : (
            <CroppedImg url={photo.url} name="" crop={photo.crop} mask={photo.mask} maskRadius={photo.maskRadius} w={box.w} h={box.h} frameClass="rounded-[1px] shadow-[0_1px_3px_rgba(0,0,0,.14)]" />
          ))}
      </div>
    </div>
  );
}
