import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAlbum } from "../store";
import { DEFAULT_CROP_FOCUS, type AlbumPage, type CellRect, type PageFill, type Photo } from "../types";
import { computeLayout, drawOrder, whitespaceToDensity } from "../lib/layout";
import { resolveCells, GRID_COLS, GRID_ROWS } from "../lib/layouts";
import { moveCell, resizeCell, restack, type Corner } from "../lib/grid-edit";
import { useView } from "../viewStore";
import { bookSizeOrDefault, ratioOf } from "../lib/book-sizes";
import { PHOTO_DND_TYPE } from "./dnd";

interface PaperProps {
  page: AlbumPage;
  // "Edit layout" mode (spec 013 Phase B): move/resize photos on the grid.
  editing?: boolean;
}

// The printable page. Photos are laid out by measuring the actual content box in pixels,
// then asking the pure engine to place each one inside its grid cell. Nothing is cropped:
// each photo is contain-fit in its region. In edit mode the cells become draggable /
// resizable on the grid (writing the page's custom placement).
export function Paper({ page, editing = false }: PaperProps) {
  const { photos, bookSize, placeOnPage, removeFromPage, setCaption, setPagePlacement } = useAlbum();
  const showGrid = useView((s) => s.showGrid);
  const aspect = ratioOf(bookSizeOrDefault(bookSize));
  const density = whitespaceToDensity(page.whitespace);
  const layoutId = page.layoutId;
  const innerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
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
  const canEdit = editing && !fullPage && items.length > 0;

  // A live working copy of the cells during an edit session (seeded on enter, cleared on
  // exit); otherwise the page's resolved cells (custom placement or named template).
  const [editCells, setEditCells] = useState<CellRect[] | null>(null);
  const workingRef = useRef<CellRect[]>([]);
  useEffect(() => {
    setEditCells(canEdit ? resolveCells(layoutId, items.length, page.placement).map((c) => ({ ...c })) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, page.id, items.length]);

  const gridCells = editCells ?? resolveCells(layoutId, items.length, page.placement);
  const gridKey = JSON.stringify(gridCells);
  const placed = useMemo(
    () => computeLayout(items, box.w, box.h, gridCells, { density }).cells,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [box.w, box.h, density, page.photoIds.join(","), gridKey],
  );
  const order = useMemo(() => drawOrder(gridCells), [gridKey]);

  const measure = useCallback(() => {
    const el = innerRef.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    setBox({ w: el.clientWidth - padX, h: el.clientHeight - padY });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasTitle, hasSubtitle, fullPage]);

  useLayoutEffect(() => {
    measure();
    const el = innerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  // Drag a cell (move its body or resize a corner) by whole grid units; commit on release.
  const beginDrag = (e: React.PointerEvent, index: number, mode: "move" | "resize", corner?: Corner) => {
    if (!editCells || box.w <= 0 || box.h <= 0) return;
    e.preventDefault();
    e.stopPropagation();
    const unitW = box.w / GRID_COLS;
    const unitH = box.h / GRID_ROWS;
    const startX = e.clientX;
    const startY = e.clientY;
    const start = editCells[index];
    const base = editCells;
    workingRef.current = base;
    let moved = false;
    const onMove = (ev: PointerEvent) => {
      const dCol = Math.round((ev.clientX - startX) / unitW);
      const dRow = Math.round((ev.clientY - startY) / unitH);
      const nextRect = mode === "move" ? moveCell(start, dCol, dRow) : resizeCell(start, corner!, dCol, dRow);
      const next = base.map((c, i) => (i === index ? nextRect : c));
      workingRef.current = next;
      moved = true;
      setEditCells(next);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (moved) setPagePlacement(page.id, workingRef.current);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const restackCell = (index: number, where: "front" | "back") => {
    if (!editCells) return;
    const next = restack(editCells, index, where);
    setEditCells(next);
    setPagePlacement(page.id, next);
  };

  const gridVisible = showGrid || canEdit;

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
                {gridVisible && <GridOverlay />}
                {items.length === 0 ? (
                  <div className="absolute inset-[12%] flex items-center justify-center rounded-md border-[1.5px] border-dashed border-line-strong p-5 text-center text-[12.5px] leading-relaxed text-faint">
                    Empty page. Drag photos here, or pick a number above.
                  </div>
                ) : (
                  order.map((idx) => {
                    const cell = placed[idx];
                    if (!cell) return null;
                    return (
                      <div
                        key={cell.item.id}
                        className="absolute flex flex-col items-center justify-center"
                        style={{ left: cell.rx, top: cell.ry, width: cell.rw, height: cell.rh }}
                      >
                        {canEdit ? (
                          <EditCell
                            photo={cell.item}
                            w={cell.w}
                            h={cell.h}
                            onMoveDown={(e) => beginDrag(e, idx, "move")}
                            onResizeDown={(e, corner) => beginDrag(e, idx, "resize", corner)}
                            onFront={() => restackCell(idx, "front")}
                            onBack={() => restackCell(idx, "back")}
                            onRemove={() => removeFromPage(cell.item.id)}
                          />
                        ) : (
                          <Cell
                            photo={cell.item}
                            w={cell.w}
                            h={cell.h}
                            onRemove={() => removeFromPage(cell.item.id)}
                            onCaption={(text) => setCaption(cell.item.id, text)}
                          />
                        )}
                      </div>
                    );
                  })
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

const CORNERS: Corner[] = ["tl", "tr", "bl", "br"];
const CORNER_POS: Record<Corner, string> = {
  tl: "-left-1.5 -top-1.5 cursor-nwse-resize",
  tr: "-right-1.5 -top-1.5 cursor-nesw-resize",
  bl: "-left-1.5 -bottom-1.5 cursor-nesw-resize",
  br: "-right-1.5 -bottom-1.5 cursor-nwse-resize",
};

interface EditCellProps {
  photo: Photo;
  w: number;
  h: number;
  onMoveDown: (e: React.PointerEvent) => void;
  onResizeDown: (e: React.PointerEvent, corner: Corner) => void;
  onFront: () => void;
  onBack: () => void;
  onRemove: () => void;
}

// A cell in "Edit layout" mode (spec 013 Phase B): fills its grid region, drag the body to
// move, drag a corner to resize (snapped to the grid), and restack / remove from a small
// toolbar. The photo stays contain-fit (never cropped); only the cell rectangle changes.
function EditCell({ photo, w, h, onMoveDown, onResizeDown, onFront, onBack, onRemove }: EditCellProps) {
  const stop = (e: React.PointerEvent) => e.stopPropagation();
  const toolBtn =
    "flex h-5 w-5 items-center justify-center rounded border-0 bg-ink/80 text-[12px] leading-none text-paper hover:bg-ink";
  return (
    <div
      className="group absolute inset-0 cursor-move touch-none select-none rounded-[2px] ring-1 ring-accent/50 hover:ring-accent"
      onPointerDown={onMoveDown}
    >
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <img
          src={photo.url}
          alt={photo.name}
          draggable={false}
          style={{ width: `${w}px`, height: `${h}px` }}
          className="block rounded-[1px] shadow-[0_1px_3px_rgba(0,0,0,.14)]"
        />
      </div>
      {CORNERS.map((corner) => (
        <span
          key={corner}
          onPointerDown={(e) => onResizeDown(e, corner)}
          className={`absolute h-3 w-3 rounded-[2px] border border-accent bg-paper opacity-0 group-hover:opacity-100 ${CORNER_POS[corner]}`}
        />
      ))}
      <div className="absolute right-1 top-1 hidden gap-1 group-hover:flex">
        <button onPointerDown={stop} onClick={onFront} title="Bring to front" className={toolBtn}>
          <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M12 19V5M6 11l6-6 6 6" />
          </svg>
        </button>
        <button onPointerDown={stop} onClick={onBack} title="Send to back" className={toolBtn}>
          <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M12 5v14M6 13l6 6 6-6" />
          </svg>
        </button>
        <button onPointerDown={stop} onClick={onRemove} title="Remove from page" className={toolBtn}>
          ×
        </button>
      </div>
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
