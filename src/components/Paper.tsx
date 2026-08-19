import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useAlbum } from "../store";
import { DEFAULT_CROP_FOCUS, type AlbumPage, type PageFill, type Photo } from "../types";
import { computeLayout, whitespaceToDensity, type PlacedCell } from "../lib/layout";
import { resolveCells, GRID_COLS, GRID_ROWS } from "../lib/layouts";
import { useView } from "../viewStore";
import { bookSizeOrDefault, ratioOf } from "../lib/book-sizes";
import { PHOTO_DND_TYPE } from "./dnd";

interface PaperProps {
  page: AlbumPage;
}

// The printable page. Photos are laid out by measuring the actual content box in
// pixels, then asking the pure engine to place each one inside a fixed region of
// the chosen layout. Nothing is cropped: each photo is contain-fit in its region.
export function Paper({ page }: PaperProps) {
  const { photos, bookSize, placeOnPage, removeFromPage, setCaption } = useAlbum();
  const showGrid = useView((s) => s.showGrid);
  const aspect = ratioOf(bookSizeOrDefault(bookSize));
  const density = whitespaceToDensity(page.whitespace);
  const layoutId = page.layoutId;
  const innerRef = useRef<HTMLDivElement>(null);
  const [cells, setCells] = useState<PlacedCell<Photo>[]>([]);
  const [hot, setHot] = useState(false);

  const hasTitle = page.title.trim().length > 0;
  const hasSubtitle = (page.subtitle ?? "").trim().length > 0;
  const hasHeader = hasTitle || hasSubtitle;
  const items = page.photoIds
    .map((id) => photos.find((p) => p.id === id))
    .filter((p): p is Photo => p !== undefined);

  // Full-page mode (spec 012): one photo owns the whole page, no header or captions.
  // Effective only with exactly one photo (the store clears it otherwise).
  const fullPage = page.fullPage && items.length === 1 ? page.fullPage : undefined;

  const measure = useCallback(() => {
    const el = innerRef.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const cw = el.clientWidth - padX;
    const ch = el.clientHeight - padY;
    const cells = resolveCells(layoutId, items.length, page.placement);
    const res = computeLayout(items, cw, ch, cells, { density });
    setCells(res.cells);
    // items, density and layout are the real inputs; recomputed via the effect below.
    // fullPage is included so toggling it re-attaches the observer to the (re)mounted box.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [density, layoutId, page.photoIds.join(","), aspect, fullPage, page.placement]);

  useLayoutEffect(() => {
    measure();
    const el = innerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <div className="paper-hatch p-[22px]">
      <div
        className="relative overflow-hidden rounded-sm bg-paper shadow-paper transition-shadow"
        style={{
          aspectRatio: String(aspect),
          boxShadow: hot ? "0 0 0 2px var(--accent)" : undefined,
          containerType: "inline-size",
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setHot(true);
        }}
        onDragLeave={() => setHot(false)}
        onDrop={(e) => {
          e.preventDefault();
          setHot(false);
          const id = e.dataTransfer.getData(PHOTO_DND_TYPE);
          if (id) placeOnPage(id, page.id);
        }}
      >
        {fullPage ? (
          <FullPagePhoto page={page} photo={items[0]} mode={fullPage} onRemove={() => removeFromPage(items[0].id)} />
        ) : (
          <>
            {hasHeader && (
              <div className="pointer-events-none absolute inset-x-[7%] top-[5.4%] z-10 text-center">
                {hasTitle && (
                  <div
                    className="font-album tracking-wide"
                    style={{ fontSize: "calc(clamp(13px, 3.1cqw, 19px) * var(--page-title-scale))", color: "var(--album-ink)" }}
                  >
                    {page.title.trim()}
                  </div>
                )}
                {hasSubtitle && (
                  <div
                    className="mt-[1%] font-album"
                    style={{ fontSize: "calc(clamp(10px, 2.2cqw, 14px) * var(--page-subtitle-scale))", color: "var(--album-ink-soft)" }}
                  >
                    {page.subtitle.trim()}
                  </div>
                )}
              </div>
            )}

            <div
              ref={innerRef}
              className="absolute inset-0"
              style={{ padding: "5%", paddingTop: hasSubtitle ? "14%" : hasTitle ? "11%" : "5%" }}
            >
              <div className="relative h-full w-full">
                {showGrid && <GridOverlay />}
                {items.length === 0 ? (
                  <div className="absolute inset-[12%] flex items-center justify-center rounded-md border-[1.5px] border-dashed border-line-strong p-5 text-center text-[12.5px] leading-relaxed text-faint">
                    Empty page. Drag photos here, or pick a number above.
                  </div>
                ) : (
                  cells.map((cell) => (
                    <div
                      key={cell.item.id}
                      className="absolute flex flex-col items-center justify-center"
                      style={{ left: cell.rx, top: cell.ry, width: cell.rw, height: cell.rh }}
                    >
                      <Cell
                        photo={cell.item}
                        w={cell.w}
                        h={cell.h}
                        onRemove={() => removeFromPage(cell.item.id)}
                        onCaption={(text) => setCaption(cell.item.id, text)}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface CellProps {
  photo: Photo;
  w: number;
  h: number;
  onRemove: () => void;
  onCaption: (text: string) => void;
}

function Cell({ photo, w, h, onRemove, onCaption }: CellProps) {
  const capRef = useRef<HTMLDivElement>(null);

  // Uncontrolled contentEditable: seed once, commit on blur. Keeps the caret
  // stable while typing and never fights React over the DOM text.
  useLayoutEffect(() => {
    if (capRef.current) capRef.current.textContent = photo.caption;
  }, [photo.id, photo.caption]);

  return (
    <div className="group relative flex flex-col items-center gap-[5px]">
      <button
        onClick={onRemove}
        title="Remove from page"
        className="absolute -right-2 -top-2 z-20 hidden h-5 w-5 items-center justify-center rounded-full border-0 bg-ink text-[12px] leading-none text-paper shadow-soft group-hover:flex"
      >
        ×
      </button>
      <img
        src={photo.url}
        alt={photo.name}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(PHOTO_DND_TYPE, photo.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        style={{ width: `${w}px`, height: `${h}px` }}
        className="block rounded-[1px] shadow-[0_1px_3px_rgba(0,0,0,.14)]"
      />
      <div
        ref={capRef}
        className="caption min-h-[14px] max-w-full break-words rounded-[3px] px-[3px] py-px text-center font-album leading-tight outline-none"
        style={{ width: `${w}px`, fontSize: "calc(10.5px * var(--caption-scale))", color: "var(--album-ink-soft)" }}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        data-empty={photo.caption.length === 0}
        onInput={(e) => {
          const el = e.currentTarget;
          el.setAttribute("data-empty", String(el.textContent!.length === 0));
        }}
        onBlur={(e) => onCaption(e.currentTarget.textContent!.trim())}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
      />
    </div>
  );
}

// A discreet 12 x 12 page grid drawn over the content box (spec 013), toggled globally
// from the top bar. Even divisions, faint theme-aware lines, non-scaling stroke so they
// stay hairline-thin under the non-uniform viewBox stretch. Purely a visual aid.
function GridOverlay() {
  // vector-effect is NOT inherited, so it must sit on each line, not the group.
  const line = (key: string, x1: number, y1: number, x2: number, y2: number) => (
    <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} vectorEffect="non-scaling-stroke" />
  );
  const lines = [];
  for (let i = 1; i < GRID_COLS; i++) lines.push(line(`v${i}`, i, 0, i, GRID_ROWS));
  for (let j = 1; j < GRID_ROWS; j++) lines.push(line(`h${j}`, 0, j, GRID_COLS, j));
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${GRID_COLS} ${GRID_ROWS}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <g stroke="var(--line-strong)" strokeWidth={1} strokeOpacity={0.45}>
        {lines}
      </g>
    </svg>
  );
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

interface FullPagePhotoProps {
  page: AlbumPage;
  photo: Photo;
  mode: PageFill;
  onRemove: () => void;
}

// A single photo owning the whole page (spec 012). `contain` (Fit) is letterboxed to the
// page with no crop; `cover` (Fill) fills the page, cropped to the page ratio, and can be
// dragged to reposition the crop focus along its overflowing axis. Neither ever distorts
// the photo (object-fit keeps the ratio); only Fill clips.
function FullPagePhoto({ page, photo, mode, onRemove }: FullPagePhotoProps) {
  const { setPageFullPageFocus } = useAlbum();
  const focus = page.fullPageFocus ?? DEFAULT_CROP_FOCUS;
  const boxRef = useRef<HTMLDivElement>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (mode !== "cover") return;
    const el = boxRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const boxRatio = rect.width / rect.height;
    // Under object-cover exactly one axis overflows; only that one can pan.
    let overflowX = 0;
    let overflowY = 0;
    if (photo.ratio > boxRatio) {
      overflowX = rect.height * photo.ratio - rect.width;
    } else {
      overflowY = rect.width / photo.ratio - rect.height;
    }
    if (overflowX <= 0 && overflowY <= 0) return; // ratio matches the page: nothing to pan
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const start = { ...focus };
    // Dragging the photo one way reveals the opposite edge, so focus moves against the drag.
    const onMove = (ev: PointerEvent) => {
      const x = overflowX > 0 ? clamp01(start.x - (ev.clientX - startX) / overflowX) : start.x;
      const y = overflowY > 0 ? clamp01(start.y - (ev.clientY - startY) / overflowY) : start.y;
      setPageFullPageFocus(page.id, { x, y });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div ref={boxRef} className="group absolute inset-0">
      <img
        src={photo.url}
        alt={photo.name}
        draggable={false}
        onPointerDown={onPointerDown}
        className={`h-full w-full ${mode === "cover" ? "object-cover cursor-grab active:cursor-grabbing" : "object-contain"}`}
        style={mode === "cover" ? { objectPosition: `${focus.x * 100}% ${focus.y * 100}%` } : undefined}
      />
      <button
        onClick={onRemove}
        title="Remove from page"
        className="absolute right-2 top-2 z-20 hidden h-6 w-6 items-center justify-center rounded-full border-0 bg-ink text-[13px] leading-none text-paper shadow-soft group-hover:flex"
      >
        ×
      </button>
      {mode === "cover" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 z-10 hidden justify-center group-hover:flex">
          <span className="rounded-full bg-ink/70 px-2.5 py-1 text-[11px] text-paper">Drag to reposition</span>
        </div>
      )}
    </div>
  );
}
