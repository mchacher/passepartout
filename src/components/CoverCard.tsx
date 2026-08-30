import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useAlbum } from "../store";
import { useT } from "../useT";
import { F_COVER_SUBTITLE, F_COVER_TITLE, headerFontCss } from "../lib/page-header";
import { COVER_MARGIN_CSS, coverBandCss } from "../lib/cover-layout";
import { coverTextFieldClasses } from "../lib/cover-text";
import { WHITESPACE_LEVELS, type CoverFace, type CoverTextPosition, type Photo } from "../types";
import { computeLayout, whitespaceToDensity } from "../lib/layout";
import { effectiveRatio } from "../lib/crop";
import { photoLayoutRatio } from "../lib/frames";
import { CroppedImg } from "./CroppedImg";
import { FramedPhoto } from "./FramedPhoto";
import { PhotoDecorControls } from "./PhotoDecorControls";
import { resolveCells } from "../lib/layouts";
import { bookSizeOrDefault, ratioOf } from "../lib/book-sizes";
import { PHOTO_DND_TYPE } from "./dnd";
import { NoteLayer } from "./NoteLayer";
import { NoteControls } from "./NoteControls";

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

  // The header lives in a FIXED band whose height depends only on whether a title / subtitle
  // is present, never on the font size: enlarging the title never shrinks the photo, and a
  // subtitle-less cover gives that band back to it. The band sits above the photo or under it
  // (spec 042). Both the band and the margin come from cover-layout.ts, the same module the
  // printed geometry reads, in cqw (a % of the cover's own width).
  const hasTitle = cover.title.trim().length > 0;
  const hasSubtitle = cover.subtitle.trim().length > 0;
  const band = coverBandCss({ hasTitle, hasSubtitle });
  // An empty field is hidden and taken out of the flow, so the block is as tall as the text it
  // shows and lands where the printed one lands (#119, #125).
  const fieldClass = coverTextFieldClasses(cover.title, cover.subtitle);
  const margin = COVER_MARGIN_CSS;
  const position: CoverTextPosition = cover.textPosition ?? "top";
  const atBottom = position === "bottom";
  // The text band and the photo area, each anchored to its own edge.
  const textBox = {
    top: atBottom ? undefined : 0,
    bottom: atBottom ? 0 : undefined,
    paddingLeft: margin,
    paddingRight: margin,
    paddingTop: atBottom ? undefined : margin,
    paddingBottom: atBottom ? margin : undefined,
  };
  const photoBox = {
    top: atBottom ? 0 : band,
    bottom: atBottom ? band : 0,
    paddingLeft: margin,
    paddingRight: margin,
    paddingTop: atBottom ? margin : undefined,
    paddingBottom: atBottom ? undefined : margin,
  };

  const boxRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  // The cover sheet in pixels, so a note lands on the same fraction of the face here, in
  // the book preview and in the PDF (spec 039).
  const [paperBox, setPaperBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = paperRef.current;
    if (!el) return;
    const measurePaper = () => setPaperBox({ w: el.clientWidth, h: el.clientHeight });
    measurePaper();
    const ro = new ResizeObserver(measurePaper);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
    // Size the box by the photo's LAYOUT ratio (crop + any frame's outer ratio, spec 054), so
    // a framed cover photo gets a box shaped for the frame, exactly like a page photo does.
    const res = computeLayout(
      [{ ratio: photoLayoutRatio(photo) }],
      cw,
      ch,
      resolveCells("single", 1),
      { density: whitespaceToDensity(cover.whitespace) },
    );
    const cell = res.cells[0];
    setSize(cell ? { w: cell.w, h: cell.h } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo?.id, photo?.ratio, photo?.crop, photo?.frame, photo?.frameWidth, photo?.mask, cover.whitespace, aspect, band, atBottom]);

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
        {/* Mask + frame for the cover photo (spec 054), the same controls as a page photo. */}
        {photo && <PhotoDecorControls photo={photo} apply={(fn) => fn(photo.id)} />}
        {/* Notes (spec 039): a cover face carries them exactly like an interior page. */}
        <NoteControls
          target={{ kind: "cover", face: which }}
          notes={cover.notes}
        />
        {/* Which side of the photo the title and subtitle sit on (spec 042). */}
        <div className="flex items-center gap-0.5 rounded-md border border-line bg-surface p-0.5" role="group" aria-label={t("cover.textPosition")}>
          {(["top", "bottom"] as const).map((side) => (
            <button
              key={side}
              onClick={() => updateCover(which, { textPosition: side })}
              aria-pressed={position === side}
              title={t(`cover.textPosition.${side}`)}
              className={`flex h-6 w-7 items-center justify-center rounded ${
                position === side ? "bg-accent text-white" : "text-muted hover:text-ink"
              }`}
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
                <rect x="3" y="4" width="18" height="16" rx="1.5" />
                <path d={side === "top" ? "M7 8.5h10" : "M7 15.5h10"} />
              </svg>
            </button>
          ))}
        </div>
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
          ref={paperRef}
          className="group relative overflow-hidden rounded-sm border border-line bg-paper shadow-paper transition-shadow"
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
          {/* Title + subtitle, edited directly on the cover, sitting in the fixed top band.
              The band is fixed but the inputs are not: two full-width rows always take their
              natural height (placeholders included), so this overlay reaches well below
              photoTop and over the photo. It is therefore transparent to the pointer as a box,
              and only the two text rows take hits (#96) - otherwise it stole the hover from
              the photo and its remove control. For the same reason an EMPTY field's placeholder
              would print itself over the photo, so it only shows on hover or focus (#119). */}
          <div className="pointer-events-none absolute inset-x-0 z-10 text-center" style={textBox}>
            {/* A box that hugs the visible lines: an empty field is positioned against it
                (see coverTextFieldClasses), so it never adds a line to the block and its
                placeholder still lands where that line would have been (#125). */}
            <div className="relative">
              <input
                value={cover.title}
                placeholder={t(`cover.${which}.title`)}
                onChange={(e) => updateCover(which, { title: e.target.value })}
                className={`pointer-events-auto w-full bg-transparent text-center font-album tracking-wide text-ink placeholder:italic placeholder:text-faint focus:outline-none ${fieldClass.title}`}
                style={{ fontSize: headerFontCss(F_COVER_TITLE, "--cover-title-scale"), color: "var(--album-ink)" }}
              />
              <input
                value={cover.subtitle}
                placeholder={t(`cover.${which}.subtitle`)}
                onChange={(e) => updateCover(which, { subtitle: e.target.value })}
                className={`pointer-events-auto mt-[2%] w-full bg-transparent text-center font-album placeholder:italic placeholder:text-faint focus:outline-none ${fieldClass.subtitle}`}
                style={{ fontSize: headerFontCss(F_COVER_SUBTITLE, "--cover-subtitle-scale"), color: "var(--album-ink-soft)" }}
              />
            </div>
          </div>

          {/* Photo area: everything the band leaves, contained photo centered (or a drop hint
              when empty). It fills from the band to the opposite margin, whichever side the
              band is on (spec 042). */}
          <div
            ref={boxRef}
            className="absolute inset-x-0 flex items-center justify-center"
            style={photoBox}
          >
            {photo && size ? (
              <CoverPhoto photo={photo} w={size.w} h={size.h} onRemove={() => updateCover(which, { photoId: null })} />
            ) : (
              <div className="pointer-events-none flex h-full w-full items-center justify-center rounded-md border-[1.5px] border-dashed border-line-strong text-center text-[12px] leading-relaxed text-faint">
                {t("cover.dropHint")}
              </div>
            )}
          </div>

          <NoteLayer
            notes={cover.notes}
            boxW={paperBox.w}
            boxH={paperBox.h}
            target={{ kind: "cover", face: which }}
          />
        </div>
      </div>
    </div>
  );
}

// The cover photo and its remove control. The control hangs on the hover of the PAPER, not
// of the photo: the text overlay above covers the photo's top strip, so a photo-scoped hover
// dropped as soon as the pointer crossed a text row on its way to the button, and the button
// vanished before it could be clicked (#96). It also sits inside the photo's corner, above
// the overlay, so it never lands on the editable text.
interface CoverPhotoProps {
  photo: Photo;
  w: number;
  h: number;
  onRemove: () => void;
}

function CoverPhoto({ photo, w, h, onRemove }: CoverPhotoProps) {
  const { t } = useT();
  return (
    <div className="relative">
      <button
        onClick={onRemove}
        title={t("cover.removePhoto")}
        className="absolute right-1.5 top-1.5 z-30 hidden h-5 w-5 items-center justify-center rounded-full border-0 bg-ink text-[12px] leading-none text-paper shadow-soft group-hover:flex"
      >
        ×
      </button>
      {photo.frame ? (
        <FramedPhoto url={photo.url} name={photo.name} crop={photo.crop} mask={photo.mask} maskRadius={photo.maskRadius} ratio={effectiveRatio(photo.ratio, photo.crop)} sourceRatio={photo.ratio} frame={photo.frame} color={photo.frameColor} text={photo.frameText} width={photo.frameWidth} focus={photo.frameFocus} w={w} h={h} />
      ) : (
        <CroppedImg url={photo.url} name={photo.name} crop={photo.crop} mask={photo.mask} maskRadius={photo.maskRadius} w={w} h={h} frameClass="rounded-[1px] shadow-[0_1px_3px_rgba(0,0,0,.14)]" />
      )}
    </div>
  );
}
