import { useEffect, useRef, useState } from "react";
import { useAlbum } from "../store";
import { useT } from "../useT";
import type { Photo } from "../types";
import { MASKS, maskClipValue, ROUNDED_SIZES, roundedRadiusOf } from "../lib/masks";
import { FRAMES, FRAME_COLORS, frameById, BORDER_WIDTHS, borderWidthOf } from "../lib/frames";

interface PhotoDecorControlsProps {
  // The primary photo whose values drive the toolbar's active state and the handwritten note.
  photo: Photo | undefined;
  // Apply a style change to the target(s): a single cover photo, or every selected page photo
  // (spec 055). The handwritten note is not batched: it always writes to `photo`.
  apply: (fn: (id: string) => void) => void;
}

// The mask + frame pickers, shared by the page toolbar (PageCard) and the cover editor
// (CoverCard, spec 054). Mask (spec 018) and frame (spec 019) live on the Photo, so the same
// controls drive both surfaces; only the "apply" target differs. Crop / tilt / layer stay in
// the page toolbar (they are single-photo and page-only).
export function PhotoDecorControls({ photo, apply }: PhotoDecorControlsProps) {
  const { setPhotoMask, setPhotoMaskRadius, setPhotoFrame, setPhotoFrameColor, setPhotoFrameText, setPhotoFrameWidth } =
    useAlbum();
  const { t } = useT();
  const [maskOpen, setMaskOpen] = useState(false);
  const [frameOpen, setFrameOpen] = useState(false);
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
  // Close both popovers when the target photo changes (a new selection).
  useEffect(() => {
    setMaskOpen(false);
    setFrameOpen(false);
  }, [photo?.id]);

  if (!photo) return null;

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setMaskOpen((v) => !v)}
          aria-pressed={maskOpen}
          title={t("page.maskTitle")}
          className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-[5px] text-[11.5px] transition-colors ${
            photo.mask
              ? "border-accent bg-accent text-white"
              : "border-line bg-surface text-muted hover:border-faint hover:text-ink"
          }`}
        >
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
            <ellipse cx="12" cy="12" rx="9" ry="6.5" />
          </svg>
          {t("page.mask")}
        </button>
        {maskOpen && (
          <>
            <button aria-label={t("page.maskClose")} className="fixed inset-0 z-20 cursor-default" onClick={() => setMaskOpen(false)} />
            <div className="absolute left-0 top-full z-30 mt-1.5 flex flex-col gap-2 rounded-lg border border-line bg-surface p-2 shadow-soft">
              <div className="flex gap-1.5">
                <button
                  onClick={() => { apply((id) => setPhotoMask(id, null)); setMaskOpen(false); }}
                  title={t("page.maskNoneTitle")}
                  className={`flex h-9 w-9 items-center justify-center rounded-md border text-[9px] ${
                    photo.mask ? "border-line text-muted hover:border-faint hover:text-ink" : "border-accent text-accent"
                  }`}
                >
                  {t("page.none")}
                </button>
                {MASKS.map((m) => (
                  <button
                    key={m.id}
                    // The rounded mask reveals a size sub-control below, so keep the popover
                    // open when it is picked; the other shapes close it (spec 034).
                    onClick={() => { apply((id) => setPhotoMask(id, m.id)); if (!m.rounded) setMaskOpen(false); }}
                    title={t(`mask.${m.id}`)}
                    aria-pressed={photo.mask === m.id}
                    className={`flex h-9 w-9 items-center justify-center rounded-md border p-1 ${
                      photo.mask === m.id ? "border-accent" : "border-line hover:border-faint"
                    }`}
                  >
                    <span
                      className="block h-full w-full bg-muted"
                      style={{ clipPath: maskClipValue(m.id, m.rounded ? { w: 28, h: 28, radius: photo.maskRadius } : {}) }}
                    />
                  </button>
                ))}
              </div>
              {photo.mask === "rounded" && (
                <div className="flex gap-1 border-t border-line pt-2">
                  {ROUNDED_SIZES.map((sz) => {
                    const active = roundedRadiusOf(photo.maskRadius) === sz.value;
                    return (
                      <button
                        key={sz.id}
                        onClick={() => apply((id) => setPhotoMaskRadius(id, sz.value))}
                        aria-pressed={active}
                        className={`flex-1 rounded-md border px-2 py-1 text-[11px] ${active ? "border-accent text-ink" : "border-line text-muted hover:border-faint hover:text-ink"}`}
                      >
                        {t(`roundedSize.${sz.id}`)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <div className="relative" ref={framePopRef}>
        <button
          onClick={() => setFrameOpen((v) => !v)}
          aria-pressed={frameOpen}
          title={t("page.frameTitle")}
          className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-[5px] text-[11.5px] transition-colors ${
            photo.frame
              ? "border-accent bg-accent text-white"
              : "border-line bg-surface text-muted hover:border-faint hover:text-ink"
          }`}
        >
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
            <rect x="3" y="3" width="18" height="18" rx="1.5" />
            <rect x="6" y="6" width="12" height="8" />
          </svg>
          {t("page.frame")}
        </button>
        {frameOpen && (
          <div className="absolute left-0 top-full z-30 mt-1.5 w-[210px] rounded-lg border border-line bg-surface p-2 shadow-soft">
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => apply((id) => setPhotoFrame(id, null))}
                title={t("page.frameNoneTitle")}
                className={`flex h-9 w-9 items-center justify-center rounded-md border text-[9px] ${
                  photo.frame ? "border-line text-muted hover:border-faint hover:text-ink" : "border-accent text-accent"
                }`}
              >
                {t("page.none")}
              </button>
              {FRAMES.map((f) => (
                <button
                  key={f.id}
                  onClick={() => apply((id) => setPhotoFrame(id, f.id))}
                  title={t(`frame.${f.id}`)}
                  aria-pressed={photo.frame === f.id}
                  className={`flex h-9 items-center justify-center rounded-md border px-2 text-[10.5px] ${
                    photo.frame === f.id ? "border-accent text-ink" : "border-line text-muted hover:border-faint hover:text-ink"
                  }`}
                >
                  {t(`frame.${f.id}`)}
                </button>
              ))}
            </div>
            {photo.frame && (
              <>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {FRAME_COLORS.map((c) => {
                    const active = (photo.frameColor ?? frameById(photo.frame)?.defaultColor) === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => apply((id) => setPhotoFrameColor(id, c.id))}
                        title={t(`frameColor.${c.id}`)}
                        aria-pressed={active}
                        className={`h-6 w-6 rounded-full border ${active ? "ring-2 ring-accent ring-offset-1 ring-offset-surface" : "border-line"}`}
                        style={{ background: c.value }}
                      />
                    );
                  })}
                </div>
                {frameById(photo.frame)?.hasText ? (
                  <>
                    <input
                      value={photo.frameText ?? ""}
                      placeholder={t("page.frameNote")}
                      onChange={(e) => setPhotoFrameText(photo.id, e.target.value)}
                      className="font-hand mt-2 w-full rounded-md border border-line bg-surface-2 px-2 py-1 text-[15px] text-ink placeholder:font-sans placeholder:text-[12px] placeholder:not-italic placeholder:text-faint focus:border-accent focus:outline-none"
                    />
                    <p className="mt-1.5 text-[10.5px] leading-snug text-faint">{t("page.frameShiftHint")}</p>
                  </>
                ) : (
                  <div className="mt-2 flex gap-1">
                    {BORDER_WIDTHS.map((bw) => {
                      const active = borderWidthOf(photo.frameWidth) === bw.value;
                      return (
                        <button
                          key={bw.id}
                          onClick={() => apply((id) => setPhotoFrameWidth(id, bw.value))}
                          aria-pressed={active}
                          className={`flex-1 rounded-md border px-2 py-1 text-[11px] ${active ? "border-accent text-ink" : "border-line text-muted hover:border-faint hover:text-ink"}`}
                        >
                          {t(`borderWidth.${bw.id}`)}
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
    </>
  );
}
