import { useCallback, useEffect, useRef, useState } from "react";
import { useAlbum } from "../store";
import { useView } from "../viewStore";
import { useT } from "../useT";
import { WHITESPACE_LEVELS, type AlbumPage } from "../types";
import { layoutsForCount, slotCount } from "../lib/layouts";
import { canArrange as pageCanArrange } from "../lib/arrange";
import { Paper, type PaperHandle, type PaperSelection } from "./Paper";
import { CropEditor } from "./CropEditor";
import { LayoutThumb } from "./LayoutThumb";
import { PhotoDecorControls } from "./PhotoDecorControls";
import { NoteControls } from "./NoteControls";
import { ROTATION_STEPS } from "../lib/rotation";

interface PageCardProps {
  page: AlbumPage;
  index: number;
}

const LEVELS = Array.from({ length: WHITESPACE_LEVELS }, (_, i) => i + 1);

// One album page: the control header (title, photo count, delete), a controls row
// (layout + whitespace), then the rendered paper below.
export function PageCard({ page, index }: PageCardProps) {
  const { setPageTitle, setPageSubtitle, setPageCount, setPageWhitespace, setPageLayout, setPageFullPage, removeFromPage, setPhotoCrop, setPhotoRotation, deletePage } =
    useAlbum();
  const { t } = useT();
  const photos = useAlbum((s) => s.photos);
  // A page's slot count is its layout capacity (spec 035): the count buttons pick it, and
  // photos fill the first slots (the rest render as empty drop targets in Paper).
  const slots = slotCount(page.layoutId, page.photoIds.length, page.placement);
  const placed = page.photoIds.length;
  const layouts = layoutsForCount(slots);
  const isFullPage = page.fullPage !== undefined;
  // Free-placement editing needs a full page (every slot filled), so it operates on real
  // cells rather than empty ones.
  const canArrange = pageCanArrange(placed, slots, isFullPage);
  // Which page is being arranged lives in the view store (spec 038): clicking a photo opens
  // it, and only one page is ever open, so entering another closes this one.
  const arrange = useView((s) => s.arrange);
  const startArrange = useView((s) => s.startArrange);
  const stopArrange = useView((s) => s.stopArrange);
  const editing = arrange?.pageId === page.id && canArrange;
  const cardRef = useRef<HTMLDivElement>(null);

  // The selected photo (reported by Paper) drives the Edit-layout toolbar, and which photo
  // the crop editor opens (spec 015).
  const paperRef = useRef<PaperHandle>(null);
  const [sel, setSel] = useState<PaperSelection | null>(null);
  const [cropping, setCropping] = useState<string | null>(null);
  const [tiltOpen, setTiltOpen] = useState(false);
  const onSelection = useCallback((s: PaperSelection | null) => {
    setSel(s);
    setTiltOpen(false);
  }, []);
  const croppingPhoto = cropping ? photos.find((p) => p.id === cropping) : undefined;
  const selPhoto = sel ? photos.find((p) => p.id === sel.photoId) : undefined;
  // Apply a style change to every selected photo (spec 055). Single-photo controls (crop,
  // tilt, layer, remove, the handwritten note) stay on the primary; mask and frame batch.
  const selCount = sel ? sel.photoIds.length : 0;
  const applyToSel = (fn: (id: string) => void) => {
    if (!sel) return;
    (sel.photoIds.length ? sel.photoIds : [sel.photoId]).forEach(fn);
  };
  // Leaving free placement (spec 038). Escape closes it, and so does a click landing outside
  // this page card. The crop editor is modal and owns the first Escape, so hold off while it
  // is open. Both listeners only exist while this page is the one being arranged.
  useEffect(() => {
    if (!editing) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || cropping) return;
      e.preventDefault();
      stopArrange();
    };
    const onPointerDown = (e: PointerEvent) => {
      if (cropping) return;
      const target = e.target;
      if (target instanceof Node && cardRef.current?.contains(target)) return;
      stopArrange();
    };
    window.addEventListener("keydown", onKeyDown);
    // Capture, so a click on a control that stops propagation still closes the mode.
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [editing, cropping, stopArrange]);


  // Full-page choices for a single-photo page (spec 012). Off = normal page; Fit fills the
  // page without cropping; Fill fills the page by cropping to the page ratio.
  const fillOptions = [
    { id: null, key: "off" },
    { id: "contain", key: "fit" },
    { id: "cover", key: "fill" },
  ] as const;

  return (
    <div ref={cardRef} className="overflow-hidden rounded-xl border border-line bg-surface-2 shadow-soft">
      <div className="flex items-center gap-3 border-b border-line px-3 py-2.5">
        <span className="whitespace-nowrap font-display text-[13px] text-muted">
          <b className="font-semibold text-accent">{index + 1}</b>
        </span>

        <div className="flex min-w-0 flex-1 flex-col">
          <input
            type="text"
            value={page.title}
            placeholder={t("page.titlePlaceholder")}
            onChange={(e) => setPageTitle(page.id, e.target.value)}
            className="min-w-0 rounded-md border border-transparent bg-transparent px-2 py-1 font-display text-[15px] text-ink placeholder:italic placeholder:text-faint hover:border-line focus:border-accent focus:bg-surface focus:outline-none"
          />
          <input
            type="text"
            value={page.subtitle}
            placeholder={t("page.subtitlePlaceholder")}
            onChange={(e) => setPageSubtitle(page.id, e.target.value)}
            className="min-w-0 rounded-md border border-transparent bg-transparent px-2 py-0.5 font-display text-[12.5px] text-muted placeholder:italic placeholder:text-faint hover:border-line focus:border-accent focus:bg-surface focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-[3px]">
          <span className="mr-1 text-[11px] text-muted">{t("page.photos")}</span>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <button
              key={n}
              onClick={() => setPageCount(page.id, n)}
              aria-pressed={slots === n}
              className={`h-[26px] w-[26px] rounded-md border font-mono text-xs ${
                slots === n
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
          title={t("page.delete")}
          className="ml-1 flex h-[27px] w-[27px] items-center justify-center rounded-md text-faint hover:bg-surface hover:text-ink"
        >
          <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth={1.6}>
            <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7" />
          </svg>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-3 py-2">
        {/* Editing is entered by clicking a photo (spec 038), so the only control left is the
            way out; Escape and a click outside the page do the same. */}
        {editing && (
          <button
            onClick={stopArrange}
            title={t("page.arrangeDone")}
            className="inline-flex items-center gap-1.5 rounded-md border border-accent bg-accent px-2.5 py-[5px] text-[11.5px] text-white transition-colors"
          >
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
              <path d="M5 13l4 4L19 7" />
            </svg>
            {t("page.done")}
          </button>
        )}

        {editing ? (
          sel ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {selCount > 1 && (
                <span className="inline-flex items-center rounded-md border border-accent bg-accent-soft px-2 py-[5px] text-[11.5px] font-medium text-accent">
                  {t("page.selectedCount", { n: selCount })}
                </span>
              )}
              <button
                onClick={() => setCropping(sel.photoId)}
                title={t("page.cropTitle")}
                className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-[5px] text-[11.5px] text-muted hover:border-faint hover:text-ink"
              >
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
                  <path d="M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14" />
                </svg>
                {t("page.crop")}
              </button>
              <PhotoDecorControls photo={selPhoto} apply={applyToSel} />
              <div className="relative">
                <button
                  onClick={() => setTiltOpen((v) => !v)}
                  aria-pressed={tiltOpen}
                  title={t("page.tiltTitle")}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-[5px] text-[11.5px] transition-colors ${
                    selPhoto?.rotation
                      ? "border-accent bg-accent text-white"
                      : "border-line bg-surface text-muted hover:border-faint hover:text-ink"
                  }`}
                >
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
                    <path d="M21 12a9 9 0 1 1-3-6.7M21 4v4h-4" />
                  </svg>
                  {t("page.tilt")}
                </button>
                {tiltOpen && (
                  <>
                    <button aria-label={t("page.tiltClose")} className="fixed inset-0 z-20 cursor-default" onClick={() => setTiltOpen(false)} />
                    <div className="absolute left-0 top-full z-30 mt-1.5 flex items-center gap-1 rounded-lg border border-line bg-surface p-2 shadow-soft">
                      {[...ROTATION_STEPS].reverse().map((s) => (
                        <button
                          key={`m${s}`}
                          onClick={() => setPhotoRotation(sel.photoId, (selPhoto?.rotation ?? 0) - s)}
                          title={t("page.tiltLeft", { n: s })}
                          className="rounded-md border border-line px-2 py-1 text-[11px] text-muted hover:border-faint hover:text-ink"
                        >
                          -{s}
                        </button>
                      ))}
                      {/* Current angle: a plain readout, not the reset control (issue #3). */}
                      <span className="w-11 select-none px-1 text-center font-mono text-[11px] text-muted" aria-live="polite">
                        {selPhoto?.rotation ?? 0}&deg;
                      </span>
                      {ROTATION_STEPS.map((s) => (
                        <button
                          key={`p${s}`}
                          onClick={() => setPhotoRotation(sel.photoId, (selPhoto?.rotation ?? 0) + s)}
                          title={t("page.tiltRight", { n: s })}
                          className="rounded-md border border-line px-2 py-1 text-[11px] text-muted hover:border-faint hover:text-ink"
                        >
                          +{s}
                        </button>
                      ))}
                      <span className="mx-0.5 h-5 w-px bg-line" aria-hidden="true" />
                      {/* Dedicated straighten control (issue #3): a clear reset to 0, disabled when level. */}
                      <button
                        onClick={() => setPhotoRotation(sel.photoId, 0)}
                        disabled={!selPhoto?.rotation}
                        title={t("page.straightenTitle")}
                        className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[11px] text-muted hover:border-faint hover:text-ink disabled:cursor-default disabled:opacity-40 disabled:hover:border-line disabled:hover:text-muted"
                      >
                        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
                          <path d="M3 12h18" />
                          <circle cx="12" cy="12" r="2.5" />
                        </svg>
                        {t("page.straighten")}
                      </button>
                    </div>
                  </>
                )}
              </div>
              {sel.overlaps && (
                <>
                  <button
                    onClick={() => paperRef.current?.restackSelected("front")}
                    title={t("page.frontTitle")}
                    className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-[5px] text-[11.5px] text-muted hover:border-faint hover:text-ink"
                  >
                    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
                      <path d="M12 19V5M6 11l6-6 6 6" />
                    </svg>
                    {t("page.front")}
                  </button>
                  <button
                    onClick={() => paperRef.current?.restackSelected("back")}
                    title={t("page.backTitle")}
                    className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-[5px] text-[11.5px] text-muted hover:border-faint hover:text-ink"
                  >
                    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
                      <path d="M12 5v14M6 13l6 6 6-6" />
                    </svg>
                    {t("page.back")}
                  </button>
                </>
              )}
              <button
                onClick={() => removeFromPage(sel.photoId, page.id)}
                title={t("page.removeTitle")}
                className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-[5px] text-[11.5px] text-muted hover:border-faint hover:text-ink"
              >
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
                  <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7" />
                </svg>
                {t("page.remove")}
              </button>
              <span className="ml-1 text-[11px] text-muted">{t("page.arrangeHint")}</span>
            </div>
          ) : (
            <span className="text-[11px] text-muted">{t("page.selectHint")}</span>
          )
        ) : (
        <>
        {/* Notes (spec 039): add one, or drive the selected one. Not offered while the page
            is being arranged, where the surface belongs to the photos. */}
        <NoteControls
          target={{ kind: "page", pageId: page.id }}
          notes={page.notes}
        />
        {layouts.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted">{t("page.layout")}</span>
            <div className="flex flex-wrap items-center gap-1">
              {layouts.map((tpl) => {
                const active = page.layoutId === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    onClick={() => setPageLayout(page.id, tpl.id)}
                    aria-pressed={active}
                    title={t(`layout.${tpl.id}`)}
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

        {/* Full page: only offered for a single-slot page that holds its one photo. Fit
            never crops; Fill crops. */}
        {slots === 1 && placed === 1 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted">{t("page.pageFill")}</span>
            <div className="flex gap-0.5 rounded-lg border border-line bg-surface p-[3px]">
              {fillOptions.map((o) => {
                const active = (page.fullPage ?? null) === o.id;
                return (
                  <button
                    key={o.key}
                    onClick={() => setPageFullPage(page.id, o.id)}
                    aria-pressed={active}
                    title={t(`page.fill.${o.key}Title`)}
                    className={`rounded-md px-2 py-[3px] text-[11.5px] transition-colors ${
                      active ? "bg-accent text-white shadow-soft" : "text-muted hover:text-ink"
                    }`}
                  >
                    {t(`page.fill.${o.key}`)}
                  </button>
                );
              })}
            </div>
            {page.fullPage === "cover" && (
              <span className="text-[10.5px] text-faint">{t("page.fillCoverHint")}</span>
            )}
          </div>
        )}

        {/* Per-page whitespace, a slider snapped to discrete levels: 1 = least white
            (photos fill their region), WHITESPACE_LEVELS = most white. Hidden at full
            page, where the photo always fills the page. */}
        {!isFullPage && (
        <label
          className="ml-auto flex items-center gap-2 text-[11px] text-muted"
          title={t("page.whitespaceTitle", { n: page.whitespace, total: WHITESPACE_LEVELS })}
        >
          <span>{t("page.whitespace")}</span>
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

      <Paper
        page={page}
        editing={editing}
        initialIndex={editing ? arrange?.index : undefined}
        onActivate={canArrange ? (index) => startArrange(page.id, index) : undefined}
        ref={paperRef}
        onSelection={onSelection}
      />

      {croppingPhoto && (
        <CropEditor
          photo={croppingPhoto}
          onApply={(crop) => {
            setPhotoCrop(croppingPhoto.id, crop);
            setCropping(null);
          }}
          onClose={() => setCropping(null)}
        />
      )}
    </div>
  );
}
