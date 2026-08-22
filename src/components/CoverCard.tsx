import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useAlbum } from "../store";
import { useT } from "../useT";
import { WHITESPACE_LEVELS, type CoverFace, type Photo } from "../types";
import { computeLayout, whitespaceToDensity } from "../lib/layout";
import { effectiveRatio } from "../lib/crop";
import { CroppedImg } from "./CroppedImg";
import { resolveCells } from "../lib/layouts";
import { bookSizeOrDefault, ratioOf } from "../lib/book-sizes";
import { PHOTO_DND_TYPE } from "./dnd";

interface CoverCardProps {
  which: CoverFace;
}

const LEVELS = Array.from({ length: WHITESPACE_LEVELS }, (_, i) => i + 1);

// A booklet cover face: editable title + subtitle, plus one optional photo dragged
// from the Library. The photo is contained (sized by the engine's single-slot path),
// never cropped. Face labels/placeholders are translated by face id (spec 032).
export function CoverCard({ which }: CoverCardProps) {
  const { photos, bookSize, frontCover, insideFrontCover, insideBackCover, backCover, updateCover } =
    useAlbum();
  const { t } = useT();
  const aspect = ratioOf(bookSizeOrDefault(bookSize));
  const cover = { front: frontCover, insideFront: insideFrontCover, insideBack: insideBackCover, back: backCover }[which];
  const label = t(`cover.${which}.label`);

  const photo = cover.photoId
    ? photos.find((p) => p.id === cover.photoId)
    : undefined;

  // The header lives in a FIXED top band (mirrors the interior pages and print.ts): its
  // height depends only on whether a title / subtitle is present, not on the font size.
  // So enlarging the title never shrinks the photo, and a subtitle-less cover gives that
  // band back to the photo. Values (in cqw = % of the cover width) mirror print.ts.
  const hasTitle = cover.title.trim().length > 0;
  const hasSubtitle = cover.subtitle.trim().length > 0;
  const photoTop = hasSubtitle ? "20cqw" : hasTitle ? "15cqw" : "6cqw";

  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  const measure = useCallback(() => {
    const el = boxRef.current;
    if (!el || !photo) {
      setSize(null);
      return;
    }
    const cs = getComputedStyle(el);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const cw = el.clientWidth - padX;
    const ch = el.clientHeight - padY;
    const res = computeLayout(
      [{ ratio: effectiveRatio(photo.ratio, photo.crop) }],
      cw,
      ch,
      resolveCells("single", 1),
      { density: whitespaceToDensity(cover.whitespace) },
    );
    const cell = res.cells[0];
    setSize(cell ? { w: cell.w, h: cell.h } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo?.id, photo?.ratio, cover.whitespace, aspect]);

  useLayoutEffect(() => {
    measure();
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  const [hot, setHot] = useState(false);

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface-2 shadow-soft">
      <div className="flex items-center gap-3 border-b border-line px-3 py-2.5">
        <span className="whitespace-nowrap font-display text-[13px] font-semibold text-accent">
          {label}
        </span>
        <span className="mr-auto text-[11px] text-muted">{t("cover.dragHint")}</span>
        <label
          className="flex items-center gap-2 text-[11px] text-muted"
          title={t("page.whitespaceTitle", { n: cover.whitespace, total: WHITESPACE_LEVELS })}
        >
          <span>{t("page.whitespace")}</span>
          <input
            type="range"
            min={1}
            max={WHITESPACE_LEVELS}
            step={1}
            value={cover.whitespace}
            onChange={(e) => updateCover(which, { whitespace: Number(e.target.value) })}
            list={`cover-ws-ticks-${which}`}
            className="w-24 accent-[color:var(--accent)]"
          />
          <datalist id={`cover-ws-ticks-${which}`}>
            {LEVELS.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <span className="w-7 font-mono tabular-nums">
            {cover.whitespace}/{WHITESPACE_LEVELS}
          </span>
        </label>
      </div>

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
            if (id) updateCover(which, { photoId: id });
          }}
        >
          {/* Title + subtitle, edited directly on the cover, sitting in the fixed top band. */}
          <div className="absolute inset-x-0 top-0 z-10 px-[6cqw] pt-[6cqw] text-center">
            <input
              value={cover.title}
              placeholder={t(`cover.${which}.title`)}
              onChange={(e) => updateCover(which, { title: e.target.value })}
              className="w-full bg-transparent text-center font-album tracking-wide text-ink placeholder:italic placeholder:text-faint focus:outline-none"
              style={{ fontSize: "calc(clamp(16px, 5cqw, 34px) * var(--cover-title-scale))", color: "var(--album-ink)" }}
            />
            <input
              value={cover.subtitle}
              placeholder={t(`cover.${which}.subtitle`)}
              onChange={(e) => updateCover(which, { subtitle: e.target.value })}
              className="mt-[2%] w-full bg-transparent text-center font-album placeholder:italic placeholder:text-faint focus:outline-none"
              style={{ fontSize: "calc(clamp(11px, 2.6cqw, 16px) * var(--cover-subtitle-scale))", color: "var(--album-ink-soft)" }}
            />
          </div>

          {/* Photo area: fills below the fixed top band, contained photo centered (or a drop
              hint when empty). Its top follows the band; sides and bottom inset by 6cqw. */}
          <div
            ref={boxRef}
            className="absolute inset-x-0 bottom-0 flex items-center justify-center px-[6cqw] pb-[6cqw]"
            style={{ top: photoTop }}
          >
            {photo && size ? (
              <CoverPhoto photo={photo} w={size.w} h={size.h} onRemove={() => updateCover(which, { photoId: null })} />
            ) : (
              <div className="pointer-events-none flex h-full w-full items-center justify-center rounded-md border-[1.5px] border-dashed border-line-strong text-center text-[12px] leading-relaxed text-faint">
                {t("cover.dropHint")}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface CoverPhotoProps {
  photo: Photo;
  w: number;
  h: number;
  onRemove: () => void;
}

function CoverPhoto({ photo, w, h, onRemove }: CoverPhotoProps) {
  const { t } = useT();
  return (
    <div className="group relative">
      <button
        onClick={onRemove}
        title={t("cover.removePhoto")}
        className="absolute -right-2 -top-2 z-20 hidden h-5 w-5 items-center justify-center rounded-full border-0 bg-ink text-[12px] leading-none text-paper shadow-soft group-hover:flex"
      >
        ×
      </button>
      <CroppedImg url={photo.url} name={photo.name} crop={photo.crop} w={w} h={h} frameClass="rounded-[1px] shadow-[0_1px_3px_rgba(0,0,0,.14)]" />
    </div>
  );
}
