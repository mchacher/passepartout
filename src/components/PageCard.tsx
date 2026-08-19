import { useState } from "react";
import { useAlbum } from "../store";
import { WHITESPACE_LEVELS, type AlbumPage } from "../types";
import { layoutsForCount } from "../lib/layouts";
import { Paper } from "./Paper";
import { LayoutThumb } from "./LayoutThumb";

interface PageCardProps {
  page: AlbumPage;
  index: number;
}

const LEVELS = Array.from({ length: WHITESPACE_LEVELS }, (_, i) => i + 1);

// One album page: the control header (title, photo count, delete), a controls row
// (layout + whitespace), then the rendered paper below.
export function PageCard({ page, index }: PageCardProps) {
  const { setPageTitle, setPageSubtitle, setPageCount, setPageWhitespace, setPageLayout, setPageFullPage, deletePage } =
    useAlbum();
  const count = page.photoIds.length;
  const layouts = layoutsForCount(count);
  const isFullPage = page.fullPage !== undefined;
  const [editing, setEditing] = useState(false);
  const canArrange = count >= 1 && !isFullPage;

  // Full-page choices for a single-photo page (spec 012). Off = normal page; Fit fills the
  // page without cropping; Fill fills the page by cropping to the page ratio.
  const fillOptions = [
    { id: null, label: "Off", title: "Normal page" },
    { id: "contain", label: "Fit", title: "Fill the page, never cropping" },
    { id: "cover", label: "Fill", title: "Fill the page, cropping to fit" },
  ] as const;

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface-2 shadow-soft">
      <div className="flex items-center gap-3 border-b border-line px-3 py-2.5">
        <span className="whitespace-nowrap font-display text-[13px] text-muted">
          <b className="font-semibold text-accent">{index + 1}</b>
        </span>

        <div className="flex min-w-0 flex-1 flex-col">
          <input
            type="text"
            value={page.title}
            placeholder="Page title (optional)"
            onChange={(e) => setPageTitle(page.id, e.target.value)}
            className="min-w-0 rounded-md border border-transparent bg-transparent px-2 py-1 font-display text-[15px] text-ink placeholder:italic placeholder:text-faint hover:border-line focus:border-accent focus:bg-surface focus:outline-none"
          />
          <input
            type="text"
            value={page.subtitle}
            placeholder="Subtitle (optional)"
            onChange={(e) => setPageSubtitle(page.id, e.target.value)}
            className="min-w-0 rounded-md border border-transparent bg-transparent px-2 py-0.5 font-display text-[12.5px] text-muted placeholder:italic placeholder:text-faint hover:border-line focus:border-accent focus:bg-surface focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-[3px]">
          <span className="mr-1 text-[11px] text-muted">Photos</span>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <button
              key={n}
              onClick={() => setPageCount(page.id, n)}
              aria-pressed={count === n}
              className={`h-[26px] w-[26px] rounded-md border font-mono text-xs ${
                count === n
                  ? "border-accent bg-accent text-white"
                  : "border-line bg-surface text-muted"
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        <button
          onClick={() => deletePage(page.id)}
          title="Delete page"
          className="ml-1 flex h-[27px] w-[27px] items-center justify-center rounded-md text-faint hover:bg-surface hover:text-ink"
        >
          <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth={1.6}>
            <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7" />
          </svg>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-3 py-2">
        {canArrange && (
          <button
            onClick={() => setEditing((v) => !v)}
            aria-pressed={editing}
            title={editing ? "Finish arranging" : "Move and resize photos on the grid"}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-[5px] text-[11.5px] transition-colors ${
              editing
                ? "border-accent bg-accent text-white"
                : "border-line bg-surface text-muted hover:border-faint hover:text-ink"
            }`}
          >
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
              <path d="M5 9V5h4M15 5h4v4M19 15v4h-4M9 19H5v-4" />
            </svg>
            {editing ? "Done" : "Arrange"}
          </button>
        )}

        {editing ? (
          <span className="text-[11px] text-muted">Click a photo to select it, then use its toolbar (crop, layer, remove). Drag to move, corners to resize.</span>
        ) : (
        <>
        {layouts.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted">Layout</span>
            <div className="flex flex-wrap items-center gap-1">
              {layouts.map((tpl) => {
                const active = page.layoutId === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    onClick={() => setPageLayout(page.id, tpl.id)}
                    aria-pressed={active}
                    title={tpl.label}
                    className={`flex h-[30px] w-[30px] items-center justify-center rounded-md border ${
                      active
                        ? "border-accent bg-accent text-white"
                        : "border-line bg-surface text-muted hover:border-faint hover:text-ink"
                    }`}
                  >
                    <LayoutThumb cells={tpl.cells} active={active} />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Full page: only offered for a single-photo page. Fit never crops; Fill crops. */}
        {count === 1 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted">Page fill</span>
            <div className="flex gap-0.5 rounded-lg border border-line bg-surface p-[3px]">
              {fillOptions.map((o) => {
                const active = (page.fullPage ?? null) === o.id;
                return (
                  <button
                    key={o.label}
                    onClick={() => setPageFullPage(page.id, o.id)}
                    aria-pressed={active}
                    title={o.title}
                    className={`rounded-md px-2 py-[3px] text-[11.5px] transition-colors ${
                      active ? "bg-accent text-white shadow-soft" : "text-muted hover:text-ink"
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
            {page.fullPage === "cover" && (
              <span className="text-[10.5px] text-faint">drag the photo to reposition the crop</span>
            )}
          </div>
        )}

        {/* Per-page whitespace, a slider snapped to discrete levels: 1 = least white
            (photos fill their region), WHITESPACE_LEVELS = most white. Hidden at full
            page, where the photo always fills the page. */}
        {!isFullPage && (
        <label
          className="ml-auto flex items-center gap-2 text-[11px] text-muted"
          title={`Whitespace level ${page.whitespace} of ${WHITESPACE_LEVELS}`}
        >
          <span>Whitespace</span>
          <input
            type="range"
            min={1}
            max={WHITESPACE_LEVELS}
            step={1}
            value={page.whitespace}
            onChange={(e) => setPageWhitespace(page.id, Number(e.target.value))}
            list={`ws-ticks-${page.id}`}
            className="w-24 accent-[color:var(--accent)]"
          />
          <datalist id={`ws-ticks-${page.id}`}>
            {LEVELS.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <span className="w-7 font-mono tabular-nums">
            {page.whitespace}/{WHITESPACE_LEVELS}
          </span>
        </label>
        )}
        </>
        )}
      </div>

      <Paper page={page} editing={editing && canArrange} />
    </div>
  );
}
