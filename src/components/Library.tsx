import { useAlbum } from "../store";
import { PHOTO_DND_TYPE } from "./dnd";

// The tray of imported photos. Placed photos are dimmed and tagged with their
// page number. Dropping a photo back here removes it from its page.
export function Library() {
  const { photos, pages, removeFromPage } = useAlbum();
  const unplaced = photos.filter((p) => p.pageId === null).length;

  const pageNumber = (pageId: string) =>
    pages.findIndex((pg) => pg.id === pageId) + 1;

  return (
    <aside className="flex min-h-0 flex-col border-r border-line bg-surface">
      <div className="flex items-baseline justify-between px-4 pb-2.5 pt-3.5">
        <h2 className="font-display text-[15px] font-medium">Library</h2>
        <span className="font-mono text-[11.5px] text-faint">
          {unplaced} / {photos.length}
        </span>
      </div>
      <p className="px-4 pb-2.5 text-[11.5px] leading-snug text-muted">
        Chronological order (capture date). Drag a photo onto a page.
      </p>

      <div
        className="grid min-h-0 flex-1 grid-cols-2 content-start gap-2.5 overflow-y-auto px-3.5 pb-4"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          const id = e.dataTransfer.getData(PHOTO_DND_TYPE);
          if (id) removeFromPage(id);
        }}
      >
        {photos.length === 0 ? (
          <div className="col-span-2 px-2 py-8 text-center text-xs leading-relaxed text-faint">
            No photos imported.
          </div>
        ) : (
          photos.map((p) => (
            <div
              key={p.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(PHOTO_DND_TYPE, p.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              className={`relative flex aspect-square cursor-grab items-center justify-center overflow-hidden rounded-[5px] border border-line bg-surface-2 active:cursor-grabbing ${
                p.pageId ? "opacity-[.34]" : ""
              }`}
            >
              <img src={p.url} alt={p.name} className="max-h-full max-w-full" draggable={false} />
              {p.pageId && (
                <span className="absolute inset-x-0 bottom-0 bg-black/70 py-0.5 text-center font-mono text-[9.5px] text-white">
                  page {pageNumber(p.pageId)}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
