import { useView } from "../viewStore";
import { useT } from "../useT";
import { ZOOM_MIN, ZOOM_MAX, ZOOM_STEP } from "../lib/zoom";

// A floating zoom slider anchored to the bottom-right of the editing area (spec 016). Zoom
// is a fraction of the available width of the central column, so 100% fits the column
// ("Fit"); smaller values shrink the pages. The Library and the thumbnail rail keep their
// size. The right offset clears the 212px thumbnail rail at the xl breakpoint. Zoom is a
// pure display scale, so photos stay contain-fit and are never cropped.
export function ZoomControl() {
  const zoom = useView((s) => s.zoom);
  const setZoom = useView((s) => s.setZoom);
  const { t } = useT();
  const pct = Math.round(zoom * 100);
  const atFit = zoom >= ZOOM_MAX;

  return (
    <div className="fixed bottom-5 right-5 z-30 flex items-center gap-2 rounded-full border border-line bg-surface/95 px-3 py-2 shadow-soft backdrop-blur xl:right-[228px]">
      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="text-muted">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3M8 11h6M11 8v6" />
      </svg>
      <input
        type="range"
        min={ZOOM_MIN}
        max={ZOOM_MAX}
        step={ZOOM_STEP}
        value={zoom}
        onChange={(e) => setZoom(Number(e.target.value))}
        aria-label={t("zoom.label")}
        title={t("zoom.label")}
        className="w-28 accent-[color:var(--accent)]"
      />
      <span className="w-9 text-right font-mono text-[11px] tabular-nums text-muted">{pct}%</span>
      <button
        onClick={() => setZoom(ZOOM_MAX)}
        disabled={atFit}
        title={t("zoom.fitTitle")}
        className={`rounded-md border px-2 py-[3px] text-[11px] ${
          atFit
            ? "border-line bg-surface text-faint"
            : "border-line bg-surface text-muted hover:border-faint hover:text-ink"
        }`}
      >
        {t("zoom.fit")}
      </button>
    </div>
  );
}
