import { Fragment, useState } from "react";
import { useAlbum } from "../store";
import type { Cover } from "../types";
import { Thumb, type ThumbPhoto } from "./Thumb";
import { PAGE_DND_TYPE } from "./dnd";

// The page navigator rail: a faithful thumbnail of every cover and content page in
// booklet order. Content pages can be dragged to reorder (covers are locked); clicking
// any thumbnail scrolls the main editor to it. Reordering only permutes the pages
// array (see store.movePage), so photos and covers are never touched.
export function PageRail() {
  const {
    photos,
    pages,
    bookSize,
    frontCover,
    insideFrontCover,
    insideBackCover,
    backCover,
    movePage,
  } = useAlbum();

  const [dragId, setDragId] = useState<string | null>(null);
  const [overSlot, setOverSlot] = useState<number | null>(null);

  const photoById = (id: string) => photos.find((p) => p.id === id);

  const pagePhotos = (photoIds: string[]): ThumbPhoto[] =>
    photoIds
      .map(photoById)
      .filter((p): p is NonNullable<typeof p> => p !== undefined)
      .map((p) => ({ id: p.id, url: p.url, ratio: p.ratio }));

  const coverPhotos = (cover: Cover): ThumbPhoto[] => {
    const p = cover.photoId ? photoById(cover.photoId) : undefined;
    return p ? [{ id: p.id, url: p.url, ratio: p.ratio }] : [];
  };

  const scrollTo = (anchor: string) =>
    document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const endDrag = () => {
    setDragId(null);
    setOverSlot(null);
  };

  const onPageDragOver = (e: React.DragEvent, index: number) => {
    if (!dragId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    setOverSlot(index + (after ? 1 : 0));
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData(PAGE_DND_TYPE) || dragId;
    if (id && overSlot !== null) movePage(id, overSlot);
    endDrag();
  };

  const line = (slot: number) =>
    overSlot === slot ? <div className="my-1 h-0.5 rounded bg-accent" /> : null;

  return (
    <aside className="hidden min-h-0 flex-col border-l border-line bg-surface xl:flex">
      <div className="px-3 pb-2 pt-3.5 text-[11px] uppercase tracking-wide text-faint">Pages</div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-6" onDrop={onDrop}>
        <RailEntry label="Front" onClick={() => scrollTo("cover-front")}>
          <Thumb photos={coverPhotos(frontCover)} layoutId="single" whitespace={frontCover.whitespace} bookSize={bookSize} />
        </RailEntry>
        <RailEntry label="Inside front" onClick={() => scrollTo("cover-insideFront")}>
          <Thumb photos={coverPhotos(insideFrontCover)} layoutId="single" whitespace={insideFrontCover.whitespace} bookSize={bookSize} />
        </RailEntry>

        {pages.map((pg, i) => (
          <Fragment key={pg.id}>
            {line(i)}
            <RailEntry
              label={`Page ${i + 1}`}
              draggable
              dragging={dragId === pg.id}
              onClick={() => scrollTo(`page-${pg.id}`)}
              onDragStart={(e) => {
                e.dataTransfer.setData(PAGE_DND_TYPE, pg.id);
                e.dataTransfer.effectAllowed = "move";
                setDragId(pg.id);
              }}
              onDragEnd={endDrag}
              onDragOver={(e) => onPageDragOver(e, i)}
            >
              <Thumb photos={pagePhotos(pg.photoIds)} layoutId={pg.layoutId} whitespace={pg.whitespace} bookSize={bookSize} fullPage={pg.fullPage} focus={pg.fullPageFocus} />
            </RailEntry>
          </Fragment>
        ))}
        {line(pages.length)}

        <RailEntry label="Inside back" onClick={() => scrollTo("cover-insideBack")}>
          <Thumb photos={coverPhotos(insideBackCover)} layoutId="single" whitespace={insideBackCover.whitespace} bookSize={bookSize} />
        </RailEntry>
        <RailEntry label="Back" onClick={() => scrollTo("cover-back")}>
          <Thumb photos={coverPhotos(backCover)} layoutId="single" whitespace={backCover.whitespace} bookSize={bookSize} />
        </RailEntry>
      </div>
    </aside>
  );
}

interface RailEntryProps {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  draggable?: boolean;
  dragging?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
}

// One rail entry: a full-width caption above its thumbnail, so long labels like
// "Inside front" stay readable and each entry reads as one block against the grey.
// Draggable rows (content pages) show a grab cursor and a small handle glyph; locked
// rows (covers) are plain and labelled in muted text.
function RailEntry({ label, onClick, children, draggable, dragging, onDragStart, onDragEnd, onDragOver }: RailEntryProps) {
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      className={`flex flex-col gap-1 ${draggable ? "cursor-grab active:cursor-grabbing" : ""} ${
        dragging ? "opacity-40" : ""
      }`}
    >
      <span
        className={`flex items-center gap-1 px-0.5 text-[10.5px] ${
          draggable ? "font-medium text-muted" : "text-faint"
        }`}
      >
        {draggable && (
          <svg width={9} height={9} viewBox="0 0 24 24" className="shrink-0 text-faint" fill="currentColor" aria-hidden="true">
            <circle cx="9" cy="6" r="1.6" />
            <circle cx="15" cy="6" r="1.6" />
            <circle cx="9" cy="12" r="1.6" />
            <circle cx="15" cy="12" r="1.6" />
            <circle cx="9" cy="18" r="1.6" />
            <circle cx="15" cy="18" r="1.6" />
          </svg>
        )}
        <span className="truncate">{label}</span>
      </span>
      <button
        onClick={onClick}
        title="Scroll to this page"
        className="rounded-[3px] outline-none ring-accent focus-visible:ring-2"
      >
        {children}
      </button>
    </div>
  );
}
