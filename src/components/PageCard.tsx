import { useCallback, useEffect, useRef, useState } from "react";
import { useAlbum } from "../store";
import { WHITESPACE_LEVELS, type AlbumPage } from "../types";
import { layoutsForCount } from "../lib/layouts";
import { Paper, type PaperHandle, type PaperSelection } from "./Paper";
import { CropEditor } from "./CropEditor";
import { LayoutThumb } from "./LayoutThumb";
import { MASKS, maskClipValue } from "../lib/masks";
import { FRAMES, FRAME_COLORS, frameById, BORDER_WIDTHS, borderWidthOf } from "../lib/frames";
import { ROTATION_STEPS } from "../lib/rotation";

interface PageCardProps {
  page: AlbumPage;
  index: number;
}

const LEVELS = Array.from({ length: WHITESPACE_LEVELS }, (_, i) => i + 1);

// One album page: the control header (title, photo count, delete), a controls row
// (layout + whitespace), then the rendered paper below.
export function PageCard({ page, index }: PageCardProps) {
  const { setPageTitle, setPageSubtitle, setPageCount, setPageWhitespace, setPageLayout, setPageFullPage, removeFromPage, setPhotoCrop, setPhotoMask, setPhotoFrame, setPhotoFrameColor, setPhotoFrameText, setPhotoFrameWidth, setPhotoRotation, deletePage } =
    useAlbum();
  const photos = useAlbum((s) => s.photos);
  const count = page.photoIds.length;
  const layouts = layoutsForCount(count);
  const isFullPage = page.fullPage !== undefined;
  const [editing, setEditing] = useState(false);
  const canArrange = count >= 1 && !isFullPage;

  // The selected photo (reported by Paper) drives the Edit-layout toolbar, and which photo
  // the crop editor opens (spec 015).
  const paperRef = useRef<PaperHandle>(null);
  const [sel, setSel] = useState<PaperSelection | null>(null);
  const [cropping, setCropping] = useState<string | null>(null);
  const [maskOpen, setMaskOpen] = useState(false);
  const [frameOpen, setFrameOpen] = useState(false);
  const [tiltOpen, setTiltOpen] = useState(false);
  // The frame picker closes on an outside pointerdown via a document listener (not a
  // full-screen backdrop), so the photo stays draggable underneath (Shift-pan, spec 019).
  const framePopRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!frameOpen) return;
    const onDown = (e: PointerEvent) => {
      if (framePopRef.current && !framePopRef.current.contains(e.target as Node)) setFrameOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [frameOpen]);
  const onSelection = useCallback((s: PaperSelection | null) => {
    setSel(s);
    setMaskOpen(false);
    setFrameOpen(false);
    setTiltOpen(false);
  }, []);
  const croppingPhoto = cropping ? photos.find((p) => p.id === cropping) : undefined;
  const selPhoto = sel ? photos.find((p) => p.id === sel.photoId) : undefined;

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
          sel ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setCropping(sel.photoId)}
                title="Crop the photo"
                className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-[5px] text-[11.5px] text-muted hover:border-faint hover:text-ink"
              >
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
                  <path d="M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14" />
                </svg>
                Crop
              </button>
              <div className="relative">
                <button
                  onClick={() => setMaskOpen((v) => !v)}
                  aria-pressed={maskOpen}
                  title="Give the photo a decorative shape"
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-[5px] text-[11.5px] transition-colors ${
                    selPhoto?.mask
                      ? "border-accent bg-accent text-white"
                      : "border-line bg-surface text-muted hover:border-faint hover:text-ink"
                  }`}
                >
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
                    <ellipse cx="12" cy="12" rx="9" ry="6.5" />
                  </svg>
                  Mask
                </button>
                {maskOpen && (
                  <>
                    <button aria-label="Close mask picker" className="fixed inset-0 z-20 cursor-default" onClick={() => setMaskOpen(false)} />
                    <div className="absolute left-0 top-full z-30 mt-1.5 flex gap-1.5 rounded-lg border border-line bg-surface p-2 shadow-soft">
                      <button
                        onClick={() => { setPhotoMask(sel.photoId, null); setMaskOpen(false); }}
                        title="No mask (rectangle)"
                        className={`flex h-9 w-9 items-center justify-center rounded-md border text-[9px] ${
                          selPhoto?.mask ? "border-line text-muted hover:border-faint hover:text-ink" : "border-accent text-accent"
                        }`}
                      >
                        None
                      </button>
                      {MASKS.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => { setPhotoMask(sel.photoId, m.id); setMaskOpen(false); }}
                          title={m.name}
                          aria-pressed={selPhoto?.mask === m.id}
                          className={`flex h-9 w-9 items-center justify-center rounded-md border p-1 ${
                            selPhoto?.mask === m.id ? "border-accent" : "border-line hover:border-faint"
                          }`}
                        >
                          <span
                            className="block h-full w-full bg-muted"
                            style={{ clipPath: maskClipValue(m.id) }}
                          />
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className="relative" ref={framePopRef}>
                <button
                  onClick={() => setFrameOpen((v) => !v)}
                  aria-pressed={frameOpen}
                  title="Frame the photo (Polaroid, colored border)"
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-[5px] text-[11.5px] transition-colors ${
                    selPhoto?.frame
                      ? "border-accent bg-accent text-white"
                      : "border-line bg-surface text-muted hover:border-faint hover:text-ink"
                  }`}
                >
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
                    <rect x="3" y="3" width="18" height="18" rx="1.5" />
                    <rect x="6" y="6" width="12" height="8" />
                  </svg>
                  Frame
                </button>
                {frameOpen && (
                    <div className="absolute left-0 top-full z-30 mt-1.5 w-[210px] rounded-lg border border-line bg-surface p-2 shadow-soft">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => setPhotoFrame(sel.photoId, null)}
                          title="No frame"
                          className={`flex h-9 w-9 items-center justify-center rounded-md border text-[9px] ${
                            selPhoto?.frame ? "border-line text-muted hover:border-faint hover:text-ink" : "border-accent text-accent"
                          }`}
                        >
                          None
                        </button>
                        {FRAMES.map((f) => (
                          <button
                            key={f.id}
                            onClick={() => setPhotoFrame(sel.photoId, f.id)}
                            title={f.name}
                            aria-pressed={selPhoto?.frame === f.id}
                            className={`flex h-9 items-center justify-center rounded-md border px-2 text-[10.5px] ${
                              selPhoto?.frame === f.id ? "border-accent text-ink" : "border-line text-muted hover:border-faint hover:text-ink"
                            }`}
                          >
                            {f.name}
                          </button>
                        ))}
                      </div>
                      {selPhoto?.frame && (
                        <>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {FRAME_COLORS.map((c) => {
                              const active = (selPhoto.frameColor ?? frameById(selPhoto.frame)?.defaultColor) === c.id;
                              return (
                                <button
                                  key={c.id}
                                  onClick={() => setPhotoFrameColor(sel.photoId, c.id)}
                                  title={c.name}
                                  aria-pressed={active}
                                  className={`h-6 w-6 rounded-full border ${active ? "ring-2 ring-accent ring-offset-1 ring-offset-surface" : "border-line"}`}
                                  style={{ background: c.value }}
                                />
                              );
                            })}
                          </div>
                          {frameById(selPhoto.frame)?.hasText ? (
                            <>
                              <input
                                value={selPhoto.frameText ?? ""}
                                placeholder="Handwritten note"
                                onChange={(e) => setPhotoFrameText(sel.photoId, e.target.value)}
                                className="font-hand mt-2 w-full rounded-md border border-line bg-surface-2 px-2 py-1 text-[15px] text-ink placeholder:font-sans placeholder:text-[12px] placeholder:not-italic placeholder:text-faint focus:border-accent focus:outline-none"
                              />
                              <p className="mt-1.5 text-[10.5px] leading-snug text-faint">Shift-drag the photo to reposition it in the frame.</p>
                            </>
                          ) : (
                            <div className="mt-2 flex gap-1">
                              {BORDER_WIDTHS.map((bw) => {
                                const active = borderWidthOf(selPhoto.frameWidth) === bw.value;
                                return (
                                  <button
                                    key={bw.id}
                                    onClick={() => setPhotoFrameWidth(sel.photoId, bw.value)}
                                    aria-pressed={active}
                                    className={`flex-1 rounded-md border px-2 py-1 text-[11px] ${active ? "border-accent text-ink" : "border-line text-muted hover:border-faint hover:text-ink"}`}
                                  >
                                    {bw.label}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                )}
              </div>
              <div className="relative">
                <button
                  onClick={() => setTiltOpen((v) => !v)}
                  aria-pressed={tiltOpen}
                  title="Tilt the photo (decorative)"
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-[5px] text-[11.5px] transition-colors ${
                    selPhoto?.rotation
                      ? "border-accent bg-accent text-white"
                      : "border-line bg-surface text-muted hover:border-faint hover:text-ink"
                  }`}
                >
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
                    <path d="M21 12a9 9 0 1 1-3-6.7M21 4v4h-4" />
                  </svg>
                  Tilt
                </button>
                {tiltOpen && (
                  <>
                    <button aria-label="Close tilt picker" className="fixed inset-0 z-20 cursor-default" onClick={() => setTiltOpen(false)} />
                    <div className="absolute left-0 top-full z-30 mt-1.5 flex items-center gap-1 rounded-lg border border-line bg-surface p-2 shadow-soft">
                      {[...ROTATION_STEPS].reverse().map((s) => (
                        <button
                          key={`m${s}`}
                          onClick={() => setPhotoRotation(sel.photoId, (selPhoto?.rotation ?? 0) - s)}
                          title={`Tilt left ${s} degrees`}
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
                          title={`Tilt right ${s} degrees`}
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
                        title="Straighten (reset to 0 degrees)"
                        className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[11px] text-muted hover:border-faint hover:text-ink disabled:cursor-default disabled:opacity-40 disabled:hover:border-line disabled:hover:text-muted"
                      >
                        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
                          <path d="M3 12h18" />
                          <circle cx="12" cy="12" r="2.5" />
                        </svg>
                        Straighten
                      </button>
                    </div>
                  </>
                )}
              </div>
              {sel.overlaps && (
                <>
                  <button
                    onClick={() => paperRef.current?.restackSelected("front")}
                    title="Bring to front"
                    className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-[5px] text-[11.5px] text-muted hover:border-faint hover:text-ink"
                  >
                    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
                      <path d="M12 19V5M6 11l6-6 6 6" />
                    </svg>
                    Front
                  </button>
                  <button
                    onClick={() => paperRef.current?.restackSelected("back")}
                    title="Send to back"
                    className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-[5px] text-[11.5px] text-muted hover:border-faint hover:text-ink"
                  >
                    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
                      <path d="M12 5v14M6 13l6 6 6-6" />
                    </svg>
                    Back
                  </button>
                </>
              )}
              <button
                onClick={() => removeFromPage(sel.photoId, page.id)}
                title="Remove from page"
                className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-[5px] text-[11.5px] text-muted hover:border-faint hover:text-ink"
              >
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
                  <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7" />
                </svg>
                Remove
              </button>
              <span className="ml-1 text-[11px] text-muted">Drag to move, corners to resize.</span>
            </div>
          ) : (
            <span className="text-[11px] text-muted">Click a photo to edit it.</span>
          )
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

      <Paper page={page} editing={editing && canArrange} ref={paperRef} onSelection={onSelection} />

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
