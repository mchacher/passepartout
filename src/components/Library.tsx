import { useMemo, useState } from "react";
import { useAlbum } from "../store";
import { useView, LIBRARY_COLS } from "../viewStore";
import { useT } from "../useT";
import { countUsage, usageCount } from "../lib/usage";
import { PHOTO_DND_TYPE } from "./dnd";

// A small glyph of `cols` bars, to convey thumbnail density (spec 030).
function DensityIcon({ cols }: { cols: number }) {
  const gap = 2;
  const pad = 2;
  const colW = (16 - pad * 2 - gap * (cols - 1)) / cols;
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden="true">
      {Array.from({ length: cols }, (_, i) => (
        <rect key={i} x={pad + i * (colW + gap)} y={pad} width={colW} height={12} rx={1} fill="currentColor" />
      ))}
    </svg>
  );
}

// The tray of imported photos, a permanent catalog (spec 017). A photo can be reused on
// several pages: each thumbnail is dimmed when used and badged with how many times it is
// used across the album (pages + cover faces). A filter shows only the unused photos.
// Dropping a photo back here removes it from every page.
export function Library() {
  const { photos, pages, frontCover, insideFrontCover, insideBackCover, backCover, unplaceFromAllPages } = useAlbum();
  const [unusedOnly, setUnusedOnly] = useState(false);
  const libraryCols = useView((s) => s.libraryCols);
  const setLibraryCols = useView((s) => s.setLibraryCols);
  const { t, tp } = useT();

  const usage = useMemo(
    () => countUsage(pages, [frontCover.photoId, insideFrontCover.photoId, insideBackCover.photoId, backCover.photoId]),
    [pages, frontCover.photoId, insideFrontCover.photoId, insideBackCover.photoId, backCover.photoId],
  );
  const unusedCount = photos.reduce((n, p) => n + (usageCount(usage, p.id) === 0 ? 1 : 0), 0);
  const shown = unusedOnly ? photos.filter((p) => usageCount(usage, p.id) === 0) : photos;

  return (
    <aside className="flex min-h-0 flex-col border-r border-line bg-surface">
      <div className="flex items-baseline justify-between px-4 pb-2.5 pt-3.5">
        <h2 className="font-display text-[15px] font-medium">{t("library.title")}</h2>
        <span className="font-mono text-[11.5px] text-faint">
          {t("library.unusedCount", { unused: unusedCount, total: photos.length })}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 px-4 pb-2.5">
        <p className="text-[11.5px] leading-snug text-muted">{t("library.chronoHint")}</p>
      </div>
      <div className="flex items-center justify-between gap-2 px-3.5 pb-2.5">
        <button
          onClick={() => setUnusedOnly((v) => !v)}
          aria-pressed={unusedOnly}
          title={t("library.unusedOnlyTitle")}
          className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-[5px] text-[11.5px] transition-colors ${
            unusedOnly
              ? "border-accent bg-accent text-white"
              : "border-line bg-surface-2 text-muted hover:border-faint hover:text-ink"
          }`}
        >
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
            <path d="M3 5h18M6 12h12M10 19h4" />
          </svg>
          {t("library.unusedOnly")}
        </button>

        {/* Thumbnail density (spec 030): more columns = smaller thumbs to scan a big library. */}
        <div className="flex items-center gap-0.5" role="group" aria-label={t("library.thumbnailSize")}>
          {LIBRARY_COLS.map((n) => (
            <button
              key={n}
              onClick={() => setLibraryCols(n)}
              aria-pressed={libraryCols === n}
              title={t("library.columns", { n })}
              className={`flex h-[26px] w-[26px] items-center justify-center rounded-md border transition-colors ${
                libraryCols === n
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-line bg-surface-2 text-muted hover:border-faint hover:text-ink"
              }`}
            >
              <DensityIcon cols={n} />
            </button>
          ))}
        </div>
      </div>

      <div
        className="grid min-h-0 flex-1 content-start gap-2.5 overflow-y-auto px-3.5 pb-4"
        style={{ gridTemplateColumns: `repeat(${libraryCols}, minmax(0, 1fr))` }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          const id = e.dataTransfer.getData(PHOTO_DND_TYPE);
          if (id) unplaceFromAllPages(id);
        }}
      >
        {photos.length === 0 ? (
          <div className="col-span-full px-2 py-8 text-center text-xs leading-relaxed text-faint">
            {t("library.empty")}
          </div>
        ) : shown.length === 0 ? (
          <div className="col-span-full px-2 py-8 text-center text-xs leading-relaxed text-faint">
            {t("library.allUsed")}
          </div>
        ) : (
          shown.map((p) => {
            const count = usageCount(usage, p.id);
            return (
              <div
                key={p.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(PHOTO_DND_TYPE, p.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                className="relative flex aspect-square cursor-grab items-center justify-center overflow-hidden rounded-[5px] border border-line bg-surface-2 active:cursor-grabbing"
              >
                <img src={p.url} alt={p.name} className="max-h-full max-w-full" draggable={false} />
                {count > 0 && (
                  <span
                    title={tp(count, { one: t("library.usedOne"), other: t("library.usedOther") })}
                    className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-mono text-[10px] leading-none text-white shadow-soft"
                  >
                    {count}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
