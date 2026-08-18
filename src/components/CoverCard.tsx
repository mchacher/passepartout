import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useAlbum } from "../store";
import { WHITESPACE_LEVELS, type CoverFace, type Photo } from "../types";
import { computeLayout, whitespaceToDensity } from "../lib/layout";
import { autoTemplate } from "../lib/layouts";
import { bookSizeOrDefault, ratioOf } from "../lib/book-sizes";
import { PHOTO_DND_TYPE } from "./dnd";

interface CoverCardProps {
  which: CoverFace;
}

const LEVELS = Array.from({ length: WHITESPACE_LEVELS }, (_, i) => i + 1);

const FACE: Record<CoverFace, { label: string; titlePlaceholder: string; subtitlePlaceholder: string }> = {
  front: { label: "Front cover", titlePlaceholder: "Album title", subtitlePlaceholder: "Subtitle or date" },
  insideFront: { label: "Inside front cover", titlePlaceholder: "Note or dedication (optional)", subtitlePlaceholder: "Optional" },
  insideBack: { label: "Inside back cover", titlePlaceholder: "Note (optional)", subtitlePlaceholder: "Optional" },
  back: { label: "Back cover", titlePlaceholder: "Closing note", subtitlePlaceholder: "Optional" },
};

// A booklet cover face: editable title + subtitle, plus one optional photo dragged
// from the Library. The photo is contained (sized by the engine's single-slot path),
// never cropped.
export function CoverCard({ which }: CoverCardProps) {
  const { photos, bookSize, frontCover, insideFrontCover, insideBackCover, backCover, updateCover } =
    useAlbum();
  const aspect = ratioOf(bookSizeOrDefault(bookSize));
  const cover = { front: frontCover, insideFront: insideFrontCover, insideBack: insideBackCover, back: backCover }[which];
  const face = FACE[which];
  const label = face.label;

  const photo = cover.photoId
    ? photos.find((p) => p.id === cover.photoId)
    : undefined;

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
      [{ ratio: photo.ratio }],
      cw,
      ch,
      autoTemplate(1),
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
        <span className="mr-auto text-[11px] text-muted">
          Drag a photo here, or leave it text-only.
        </span>
        <label
          className="flex items-center gap-2 text-[11px] text-muted"
          title={`Whitespace level ${cover.whitespace} of ${WHITESPACE_LEVELS}`}
        >
          <span>Whitespace</span>
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
          className="relative flex flex-col overflow-hidden rounded-sm bg-paper shadow-paper transition-shadow"
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
          {/* Title + subtitle, edited directly on the cover. */}
          <div className="z-10 px-[9%] pt-[9%] text-center">
            <input
              value={cover.title}
              placeholder={face.titlePlaceholder}
              onChange={(e) => updateCover(which, { title: e.target.value })}
              className="w-full bg-transparent text-center font-album tracking-wide text-ink placeholder:italic placeholder:text-faint focus:outline-none"
              style={{ fontSize: "calc(clamp(16px, 5cqw, 34px) * var(--cover-title-scale))", color: "var(--album-ink)" }}
            />
            <input
              value={cover.subtitle}
              placeholder={face.subtitlePlaceholder}
              onChange={(e) => updateCover(which, { subtitle: e.target.value })}
              className="mt-[2%] w-full bg-transparent text-center font-album placeholder:italic placeholder:text-faint focus:outline-none"
              style={{ fontSize: "calc(clamp(11px, 2.6cqw, 16px) * var(--cover-subtitle-scale))", color: "var(--album-ink-soft)" }}
            />
          </div>

          {/* Photo band: contained photo, or a drop hint when empty. */}
          <div
            ref={boxRef}
            className="relative flex min-h-0 flex-1 items-center justify-center p-[9%]"
          >
            {photo && size ? (
              <CoverPhoto photo={photo} w={size.w} h={size.h} onRemove={() => updateCover(which, { photoId: null })} />
            ) : (
              <div className="pointer-events-none flex h-full w-full items-center justify-center rounded-md border-[1.5px] border-dashed border-line-strong text-center text-[12px] leading-relaxed text-faint">
                Drag a photo here (optional)
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
  return (
    <div className="group relative">
      <button
        onClick={onRemove}
        title="Remove cover photo"
        className="absolute -right-2 -top-2 z-20 hidden h-5 w-5 items-center justify-center rounded-full border-0 bg-ink text-[12px] leading-none text-paper shadow-soft group-hover:flex"
      >
        ×
      </button>
      <img
        src={photo.url}
        alt={photo.name}
        style={{ width: `${w}px`, height: `${h}px` }}
        className="block rounded-[1px] shadow-[0_1px_3px_rgba(0,0,0,.14)]"
      />
    </div>
  );
}
