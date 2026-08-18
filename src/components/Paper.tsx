import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useAlbum } from "../store";
import { PAGE_ASPECT, type AlbumPage, type Photo } from "../types";
import { computeLayout, whitespaceToDensity, type PlacedCell } from "../lib/layout";
import { resolveNode } from "../lib/layouts";
import { PHOTO_DND_TYPE } from "./dnd";

interface PaperProps {
  page: AlbumPage;
}

// The printable page. Photos are laid out by measuring the actual content box in
// pixels, then asking the pure engine to place each one inside a fixed region of
// the chosen layout. Nothing is cropped: each photo is contain-fit in its region.
export function Paper({ page }: PaperProps) {
  const { photos, format, placeOnPage, removeFromPage, setCaption } = useAlbum();
  const density = whitespaceToDensity(page.whitespace);
  const layoutId = page.layoutId;
  const innerRef = useRef<HTMLDivElement>(null);
  const [cells, setCells] = useState<PlacedCell<Photo>[]>([]);
  const [hot, setHot] = useState(false);

  const hasTitle = page.title.trim().length > 0;
  const items = page.photoIds
    .map((id) => photos.find((p) => p.id === id))
    .filter((p): p is Photo => p !== undefined);

  const measure = useCallback(() => {
    const el = innerRef.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const cw = el.clientWidth - padX;
    const ch = el.clientHeight - padY;
    const node = resolveNode(layoutId, items.length);
    const res = computeLayout(items, cw, ch, node, { density });
    setCells(res.cells);
    // items, density and layout are the real inputs; recomputed via the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [density, layoutId, page.photoIds.join(","), format]);

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
          aspectRatio: String(PAGE_ASPECT[format]),
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
        {hasTitle && (
          <div
            className="pointer-events-none absolute inset-x-[7%] top-[5.4%] z-10 text-center font-album tracking-wide"
            style={{ fontSize: "clamp(13px, 3.1cqw, 19px)", color: "var(--album-ink)" }}
          >
            {page.title.trim()}
          </div>
        )}

        <div
          ref={innerRef}
          className="absolute inset-0"
          style={{ padding: "7%", paddingTop: hasTitle ? "13%" : "7%" }}
        >
          {items.length === 0 ? (
            <div className="absolute inset-[12%] flex items-center justify-center rounded-md border-[1.5px] border-dashed border-line-strong p-5 text-center text-[12.5px] leading-relaxed text-faint">
              Empty page. Drag photos here, or pick a number above.
            </div>
          ) : (
            <div className="relative h-full w-full">
              {cells.map((cell) => (
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
              ))}
            </div>
          )}
        </div>
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
        className="caption min-h-[14px] max-w-full break-words rounded-[3px] px-[3px] py-px text-center font-album text-[10.5px] leading-tight outline-none"
        style={{ width: `${w}px`, color: "var(--album-ink-soft)" }}
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
