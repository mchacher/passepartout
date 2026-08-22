import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAlbum } from "../store";
import { useT } from "../useT";
import { DEFAULT_CROP_FOCUS, type AlbumPage, type CellRect, type PageFill, type Photo } from "../types";
import { computeLayout, drawOrder, gridRegions, whitespaceToDensity } from "../lib/layout";
import { resolveCells, slotCount, GRID_COLS, GRID_ROWS } from "../lib/layouts";
import { moveCell, resizeCell, restack, panAnchor, snapAnchor, type Corner } from "../lib/grid-edit";
import { effectiveRatio } from "../lib/crop";
import { photoLayoutRatio, frameById, frameInner } from "../lib/frames";
import { useView } from "../viewStore";
import { bookSizeOrDefault, ratioOf } from "../lib/book-sizes";
import { CroppedImg } from "./CroppedImg";
import { FramedPhoto } from "./FramedPhoto";
import { PHOTO_DND_TYPE, PHOTO_SLOT_DND_TYPE } from "./dnd";

// The selected photo's context, reported up so the page controls can show its toolbar.
export interface PaperSelection {
  photoId: string;
  overlaps: boolean; // the selected cell overlaps another (front/back is meaningful)
}

// Imperative actions the page toolbar drives on the current selection.
export interface PaperHandle {
  restackSelected: (where: "front" | "back") => void;
}

interface PaperProps {
  page: AlbumPage;
  // "Edit layout" mode (spec 013 Phase B): move/resize photos on the grid.
  editing?: boolean;
  onSelection?: (sel: PaperSelection | null) => void;
}

const rectsOverlap = (a: CellRect, b: CellRect) =>
  a.col < b.col + b.colSpan && b.col < a.col + a.colSpan && a.row < b.row + b.rowSpan && b.row < a.row + a.rowSpan;

// The printable page. Photos are laid out by measuring the actual content box in pixels,
// then asking the pure engine to place each one inside its grid cell. Nothing is cropped:
// each photo is contain-fit in its region. In edit mode the cells become draggable /
// resizable on the grid (writing the page's custom placement).
export const Paper = forwardRef<PaperHandle, PaperProps>(function Paper({ page, editing = false, onSelection }, ref) {
  const { photos, bookSize, placeOnPage, removeFromPage, swapPhotosOnPage, setCaption, setPagePlacement, setPhotoFrameFocus } = useAlbum();
  const { t } = useT();
  const showGrid = useView((s) => s.showGrid);
  // The filled slot a placed photo is currently dragged over (display mode), highlighted as
  // the swap target (spec 056). Null when no same-app photo drag is hovering a slot.
  const [swapOver, setSwapOver] = useState<number | null>(null);
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

  // The page's slot count (spec 035): its layout capacity. Photos fill the first slots in
  // order; the remaining cells render as empty drop targets. slots >= items.length always.
  const slots = slotCount(layoutId, items.length, page.placement);

  // Full-page mode (spec 012): one photo owns the whole page, no header or captions.
  // Effective only with exactly one photo (the store clears it otherwise).
  const fullPage = page.fullPage && items.length === 1 ? page.fullPage : undefined;
  // Free-placement editing needs a full page (spec 035): every slot filled, so the editor
  // never has to arrange an empty cell.
  const canEdit = editing && !fullPage && items.length > 0 && items.length === slots;

  // A live working copy of the cells during an edit session (seeded on enter, cleared on
  // exit); otherwise the page's resolved cells (custom placement or named template).
  const [editCells, setEditCells] = useState<CellRect[] | null>(null);
  // The selected cell index while editing (spec 015): its actions show in the page toolbar.
  const [selected, setSelected] = useState<number | null>(null);
  const workingRef = useRef<CellRect[]>([]);
  useEffect(() => {
    setEditCells(canEdit ? resolveCells(layoutId, slots, page.placement).map((c) => ({ ...c })) : null);
    setSelected(canEdit && items.length > 0 ? 0 : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, page.id, items.length]);

  // The page renders `slots` cells (spec 035): the first items.length hold photos, the rest
  // are empty placeholders.
  const gridCells = editCells ?? resolveCells(layoutId, slots, page.placement);
  const gridKey = JSON.stringify(gridCells);
  // The engine lays out by each photo's EFFECTIVE ratio (its crop's ratio; spec 015), so a
  // cropped photo re-fits its cell as a photo of the kept region. The cell item keeps the
  // Photo fields (url/crop) for rendering.
  const engineItems = items.map((p) => ({ ...p, ratio: photoLayoutRatio(p) }));
  const cropKey = items.map((p) => (p.crop ? `${p.crop.x},${p.crop.y},${p.crop.w},${p.crop.h}` : "-")).join("|");
  // A mask changes only how a cell renders, not the geometry, but the memoized cells embed
  // the item objects, so re-run the layout when a mask changes to refresh them (spec 018).
  const maskKey = items.map((p) => p.mask ?? "-").join("|");
  // A frame (style / color / note) also only changes how a cell renders; refresh the
  // memoized cells when it changes, like the mask (spec 019).
  const frameKey = items
    .map((p) => `${p.frame ?? "-"},${p.frameColor ?? "-"},${p.frameText ?? "-"},${p.frameWidth ?? "-"},${p.frameFocus ? `${p.frameFocus.x}:${p.frameFocus.y}` : "-"},${p.rotation ?? "-"}`)
    .join("|");
  const placed = useMemo(
    () => computeLayout(engineItems, box.w, box.h, gridCells, { density }).cells,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [box.w, box.h, density, page.photoIds.join(","), gridKey, cropKey, maskKey, frameKey],
  );
  const order = useMemo(() => drawOrder(gridCells), [gridKey]);
  // Every slot's fixed region (spec 035): filled cells use `placed`, empty slots (indices
  // >= items.length) render a placeholder over their region here.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const regions = useMemo(() => gridRegions(gridCells, box.w, box.h), [gridKey, box.w, box.h]);
  const selCell = selected != null ? placed[selected] : undefined;
  const selOverlaps = useMemo(() => {
    if (selected == null) return false;
    const a = gridCells[selected];
    return !!a && gridCells.some((b, i) => i !== selected && rectsOverlap(a, b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridKey, selected]);

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

  // Drag a cell: move its body, resize a corner (both snap to grid units), or pan the
  // photo within its cell's whitespace (Shift, no crop). Commit on release.
  const beginDrag = (e: React.PointerEvent, index: number, mode: "move" | "resize" | "pan", corner?: Corner) => {
    if (!editCells || box.w <= 0 || box.h <= 0) return;
    e.preventDefault();
    e.stopPropagation();
    setSelected(index);

    // Polaroid focus pan (spec 019): Shift-drag moves which square region of the photo shows
    // in the window, instead of panning the cell whitespace. Only the overflowing axis moves.
    const fitem = items[index];
    const fstyle = frameById(fitem?.frame);
    if (mode === "pan" && fstyle?.square) {
      const pc0 = placed[index];
      if (!pc0) return;
      const side = frameInner(fstyle, pc0.w, pc0.h, 0).w || 1; // window side in px
      const start0 = fitem.frameFocus ?? DEFAULT_CROP_FOCUS;
      const landscape = fitem.ratio >= 1;
      const sx = e.clientX;
      const sy = e.clientY;
      const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
      const onMoveF = (ev: PointerEvent) => {
        // Drag reveals the opposite edge, so the focus moves against the drag.
        const next = landscape
          ? { x: clamp01(start0.x - (ev.clientX - sx) / side), y: 0.5 }
          : { x: 0.5, y: clamp01(start0.y - (ev.clientY - sy) / side) };
        setPhotoFrameFocus(fitem.id, next);
      };
      const onUpF = () => {
        window.removeEventListener("pointermove", onMoveF);
        window.removeEventListener("pointerup", onUpF);
      };
      window.addEventListener("pointermove", onMoveF);
      window.addEventListener("pointerup", onUpF);
      return;
    }

    const unitW = box.w / GRID_COLS;
    const unitH = box.h / GRID_ROWS;
    const startX = e.clientX;
    const startY = e.clientY;
    const start = editCells[index];
    const base = editCells;
    // Free space (region minus contain-fit photo) for a pan; the photo never leaves its cell.
    const pc = placed[index];
    const freeX = pc ? pc.rw - pc.w : 0;
    const freeY = pc ? pc.rh - pc.h : 0;
    workingRef.current = base;
    let moved = false;
    const onMove = (ev: PointerEvent) => {
      let nextRect = start;
      if (mode === "move") {
        nextRect = moveCell(start, Math.round((ev.clientX - startX) / unitW), Math.round((ev.clientY - startY) / unitH));
      } else if (mode === "resize") {
        nextRect = resizeCell(start, corner!, Math.round((ev.clientX - startX) / unitW), Math.round((ev.clientY - startY) / unitH));
      } else {
        nextRect = {
          ...start,
          ax: snapAnchor(panAnchor(start.ax ?? 0.5, ev.clientX - startX, freeX)),
          ay: snapAnchor(panAnchor(start.ay ?? 0.5, ev.clientY - startY, freeY)),
        };
      }
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

  // Report the current selection up so the page controls can render its toolbar.
  useEffect(() => {
    onSelection?.(canEdit && selCell ? { photoId: selCell.item.id, overlaps: selOverlaps } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, selCell?.item.id, selOverlaps]);

  useImperativeHandle(
    ref,
    () => ({
      restackSelected: (where) => {
        if (selected != null) restackCell(selected, where);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected, editCells],
  );

  // Hold Shift while editing to pan a photo inside its cell (hand cursor).
  const [shiftHeld, setShiftHeld] = useState(false);
  useEffect(() => {
    if (!canEdit) return;
    const onKey = (e: KeyboardEvent) => setShiftHeld(e.shiftKey);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      setShiftHeld(false);
    };
  }, [canEdit]);

  const gridVisible = showGrid || canEdit;

  return (
    <div className="paper-hatch p-[22px]">
      <div
        className="relative overflow-hidden rounded-sm border border-line bg-paper shadow-paper transition-shadow"
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
          <FullPagePhoto page={page} photo={items[0]} mode={fullPage} onRemove={() => removeFromPage(items[0].id, page.id)} />
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
              style={{ padding: "5%", paddingTop: hasSubtitle ? "12.5%" : hasTitle ? "10%" : "5%" }}
            >
              <div className="relative h-full w-full">
                {gridVisible && <GridOverlay />}
                {order.map((idx) => {
                  const cell = placed[idx];
                  // Empty slot (spec 035): a dashed placeholder. The whole page is the drop
                  // target (onDrop), so a dropped photo fills the next empty slot.
                  if (!cell) {
                    const region = regions[idx];
                    if (!region) return null;
                    return (
                      <div
                        key={`slot-${idx}`}
                        title={t("page.emptySlot")}
                        aria-label={t("page.emptySlot")}
                        className="absolute flex items-center justify-center rounded-md border-[1.5px] border-dashed border-line-strong text-[18px] leading-none text-faint"
                        style={{ left: region.x, top: region.y, width: region.w, height: region.h }}
                      >
                        +
                      </div>
                    );
                  }
                  return (
                    <div
                      key={cell.item.id}
                      className={`absolute ${!canEdit && swapOver === idx ? "rounded-[2px] ring-2 ring-accent" : ""}`}
                      style={{ left: cell.rx, top: cell.ry, width: cell.rw, height: cell.rh }}
                      // Display mode: this filled slot is a drop target so a placed photo
                      // dragged onto it swaps the two, and a library photo dropped here still
                      // lands on the page (spec 056). Edit mode uses pointer drags instead.
                      onDragOver={
                        canEdit
                          ? undefined
                          : (e) => {
                              const types = e.dataTransfer.types;
                              if (!types.includes(PHOTO_SLOT_DND_TYPE) && !types.includes(PHOTO_DND_TYPE)) return;
                              e.preventDefault();
                              e.stopPropagation();
                              e.dataTransfer.dropEffect = "move";
                              if (types.includes(PHOTO_SLOT_DND_TYPE)) setSwapOver(idx);
                            }
                      }
                      onDragLeave={canEdit ? undefined : () => setSwapOver((o) => (o === idx ? null : o))}
                      onDrop={
                        canEdit
                          ? undefined
                          : (e) => {
                              const slot = e.dataTransfer.getData(PHOTO_SLOT_DND_TYPE);
                              const libId = e.dataTransfer.getData(PHOTO_DND_TYPE);
                              if (!slot && !libId) return;
                              e.preventDefault();
                              e.stopPropagation();
                              setSwapOver(null);
                              setHot(false);
                              if (slot) {
                                const sep = slot.lastIndexOf(":");
                                const srcPage = slot.slice(0, sep);
                                const srcIdx = Number(slot.slice(sep + 1));
                                if (srcPage === page.id && Number.isInteger(srcIdx)) {
                                  swapPhotosOnPage(page.id, srcIdx, idx);
                                  return;
                                }
                              }
                              if (libId) placeOnPage(libId, page.id);
                            }
                      }
                    >
                      {canEdit ? (
                        <EditCell
                          photo={items[idx] ?? cell.item}
                          w={cell.w}
                          h={cell.h}
                          ox={cell.ox}
                          oy={cell.oy}
                          panHint={shiftHeld}
                          selected={selected === idx}
                          onMoveDown={(e) => beginDrag(e, idx, e.shiftKey ? "pan" : "move")}
                          onResizeDown={(e, corner) => beginDrag(e, idx, "resize", corner)}
                        />
                      ) : (
                        <div className="absolute" style={{ left: cell.ox, top: cell.oy, width: cell.w }}>
                          <Cell
                            photo={items[idx] ?? cell.item}
                            w={cell.w}
                            h={cell.h}
                            slot={{ pageId: page.id, index: idx }}
                            onRemove={() => removeFromPage(cell.item.id, page.id)}
                            onCaption={(text) => setCaption(cell.item.id, text)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
});

interface CellProps {
  photo: Photo;
  w: number;
  h: number;
  // Where this photo sits, so dragging it onto another slot of the same page can swap them
  // (spec 056). The slot index is the photo's position in the page's photoIds.
  slot?: { pageId: string; index: number };
  onRemove: () => void;
  onCaption: (text: string) => void;
}

function Cell({ photo, w, h, slot, onRemove, onCaption }: CellProps) {
  const { t } = useT();
  const capRef = useRef<HTMLDivElement>(null);

  // Uncontrolled contentEditable: seed once, commit on blur. Keeps the caret
  // stable while typing and never fights React over the DOM text.
  useLayoutEffect(() => {
    if (capRef.current) capRef.current.textContent = photo.caption;
  }, [photo.id, photo.caption]);

  return (
    <div className="group relative">
      <button
        onClick={onRemove}
        title={t("page.removeTitle")}
        className="absolute -right-2 -top-2 z-20 hidden h-5 w-5 items-center justify-center rounded-full border-0 bg-ink text-[12px] leading-none text-paper shadow-soft group-hover:flex"
      >
        ×
      </button>
      {/* Tilt group (spec 020, #5): the photo and its caption rotate together about the photo
          center, so the caption follows the tilt instead of staying level below it. */}
      <div
        className="flex flex-col items-center gap-[5px]"
        style={{ transform: photo.rotation ? `rotate(${photo.rotation}deg)` : undefined, transformOrigin: `center ${h / 2}px` }}
      >
        <div
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(PHOTO_DND_TYPE, photo.id);
            if (slot) e.dataTransfer.setData(PHOTO_SLOT_DND_TYPE, `${slot.pageId}:${slot.index}`);
            e.dataTransfer.effectAllowed = "move";
          }}
        >
          {photo.frame ? (
            <FramedPhoto url={photo.url} name={photo.name} crop={photo.crop} mask={photo.mask} maskRadius={photo.maskRadius} ratio={effectiveRatio(photo.ratio, photo.crop)} sourceRatio={photo.ratio} frame={photo.frame} color={photo.frameColor} text={photo.frameText} width={photo.frameWidth} focus={photo.frameFocus} w={w} h={h} />
          ) : (
            <CroppedImg url={photo.url} name={photo.name} crop={photo.crop} mask={photo.mask} maskRadius={photo.maskRadius} w={w} h={h} frameClass="rounded-[1px] shadow-[0_1px_3px_rgba(0,0,0,.14)]" />
          )}
        </div>
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
  ox: number;
  oy: number;
  panHint: boolean;
  selected: boolean;
  onMoveDown: (e: React.PointerEvent) => void;
  onResizeDown: (e: React.PointerEvent, corner: Corner) => void;
}

// A cell in "Edit layout" mode: drag the body to move, Shift-drag to pan the photo in its
// whitespace, and (when selected) drag a corner to resize. Selecting a cell surfaces its
// actions (crop / layer / remove) in the page toolbar above, so they are always visible.
function EditCell({ photo, w, h, ox, oy, panHint, selected, onMoveDown, onResizeDown }: EditCellProps) {
  return (
    <div
      className={`absolute inset-0 touch-none select-none rounded-[2px] ring-1 ${
        selected ? "ring-2 ring-accent" : "ring-accent/40 hover:ring-accent/70"
      } ${panHint ? "cursor-grab active:cursor-grabbing" : "cursor-move"}`}
      onPointerDown={onMoveDown}
    >
      <div className="pointer-events-none absolute" style={{ left: `${ox}px`, top: `${oy}px` }}>
        {photo.frame ? (
          <FramedPhoto url={photo.url} name={photo.name} crop={photo.crop} mask={photo.mask} maskRadius={photo.maskRadius} ratio={effectiveRatio(photo.ratio, photo.crop)} sourceRatio={photo.ratio} frame={photo.frame} color={photo.frameColor} text={photo.frameText} width={photo.frameWidth} focus={photo.frameFocus} rotation={photo.rotation} w={w} h={h} />
        ) : (
          <CroppedImg url={photo.url} name={photo.name} crop={photo.crop} mask={photo.mask} maskRadius={photo.maskRadius} rotation={photo.rotation} w={w} h={h} frameClass="rounded-[1px] shadow-[0_1px_3px_rgba(0,0,0,.14)]" />
        )}
      </div>
      {selected &&
        CORNERS.map((corner) => (
          <span
            key={corner}
            onPointerDown={(e) => onResizeDown(e, corner)}
            className={`absolute h-3 w-3 rounded-[2px] border border-accent bg-paper ${CORNER_POS[corner]}`}
          />
        ))}
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
  const { t } = useT();
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
        title={t("page.removeTitle")}
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
