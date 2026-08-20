import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAlbum } from "../store";
import type { Cover, CoverFace } from "../types";
import { bookLeaves, toSpreads, spreadIndexOfLeaf, spreadLabel, fitSpread, type Leaf } from "../lib/preview";
import { bookSizeOrDefault, ratioOf } from "../lib/book-sizes";
import { estimateSpineMm } from "../lib/print";
import { effectiveSpineTitle } from "../lib/project";
import { PreviewPaper, type PreviewPhoto } from "./PreviewPaper";
import { Thumb, type ThumbPhoto } from "./Thumb";

interface BookPreviewProps {
  open: boolean;
  onClose: () => void;
}

// The two pages of a spread meet at the spine (no gap); the binding is suggested by a
// gutter shadow drawn over the seam rather than by empty space between the pages.
const GUTTER_FRAC = 0;
// A soft drop shadow so the open book sits on the dark surface (replaces the paper halo).
const BOOK_SHADOW = "0 28px 55px -22px rgba(0,0,0,0.8), 0 8px 22px -12px rgba(0,0,0,0.55)";

// A full-screen, read-only read-through of the whole book in double-page spreads
// (spec 011). It reuses the pure engine via PreviewPaper, so every photo stays
// contain-fit. A thumbnail rail on the right jumps to any leaf; arrows/Escape and the
// backdrop drive navigation. No editing happens here.
export function BookPreview({ open, onClose }: BookPreviewProps) {
  const {
    photos,
    pages,
    bookSize,
    frontCover,
    insideFrontCover,
    insideBackCover,
    backCover,
    spine,
    activeName,
  } = useAlbum();

  const covers: Record<CoverFace, Cover> = useMemo(
    () => ({ front: frontCover, insideFront: insideFrontCover, insideBack: insideBackCover, back: backCover }),
    [frontCover, insideFrontCover, insideBackCover, backCover],
  );

  const leaves = useMemo(() => bookLeaves(pages.map((p) => p.id)), [pages]);
  const spreads = useMemo(() => toSpreads(leaves), [leaves]);
  // The preview leads with a flat cover-wrap spread (back | spine | front) so the spine is
  // visible as it prints (#2); the normal reading spreads follow it (offset by one).
  const spreadCount = spreads.length + 1;

  const [index, setIndex] = useState(0);
  // Keep the index in range when the book changes (pages added/removed) or on reopen.
  useEffect(() => {
    setIndex((i) => Math.max(0, Math.min(i, spreadCount - 1)));
  }, [spreadCount]);

  const stageRef = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState({ w: 0, h: 0 });

  const measure = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    // clientWidth/Height include the stage padding; subtract it so the spread is sized to
    // the actual free area and keeps its breathing room from the edges and the controls.
    const cs = getComputedStyle(el);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    setAvail({ w: el.clientWidth - padX, h: el.clientHeight - padY });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, measure]);

  const go = useCallback(
    (delta: number) => setIndex((i) => Math.max(0, Math.min(i + delta, spreadCount - 1))),
    [spreadCount],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, go]);

  if (!open || spreads.length === 0) return null;

  const photoById = (id: string | null | undefined) => (id ? photos.find((p) => p.id === id) : undefined);

  const pagePreviewPhotos = (photoIds: string[]): PreviewPhoto[] =>
    photoIds
      .map((id) => photoById(id))
      .filter((p): p is NonNullable<typeof p> => p !== undefined)
      .map((p) => ({ id: p.id, url: p.url, ratio: p.ratio, caption: p.caption, crop: p.crop, mask: p.mask, frame: p.frame, frameColor: p.frameColor, frameText: p.frameText, frameWidth: p.frameWidth, frameFocus: p.frameFocus, rotation: p.rotation }));

  const coverPreviewPhoto = (cover: Cover): PreviewPhoto | null => {
    const p = photoById(cover.photoId);
    return p ? { id: p.id, url: p.url, ratio: p.ratio, caption: "", crop: p.crop } : null;
  };

  const pageThumbPhotos = (photoIds: string[]): ThumbPhoto[] =>
    photoIds
      .map((id) => photoById(id))
      .filter((p): p is NonNullable<typeof p> => p !== undefined)
      .map((p) => ({ id: p.id, url: p.url, ratio: p.ratio, crop: p.crop, mask: p.mask }));

  const coverThumbPhotos = (cover: Cover): ThumbPhoto[] => {
    const p = photoById(cover.photoId);
    return p ? [{ id: p.id, url: p.url, ratio: p.ratio, crop: p.crop }] : [];
  };

  // Derive a clamped index at render so a shrunk book (pages removed while open) can never
  // index past the end before the reset effect runs. Index 0 is the flat cover wrap; the
  // reading spreads start at index 1 (hence the -1 into `spreads`).
  const clampedIndex = Math.min(Math.max(index, 0), spreadCount - 1);
  const isWrap = clampedIndex === 0;
  const spread = isWrap ? null : spreads[clampedIndex - 1];
  const aspect = ratioOf(bookSizeOrDefault(bookSize));
  // Size every leaf at the two-page-spread scale so a lone outside cover (front / back) is the
  // same size as an interior page instead of dwarfing them (#2). A single leaf is centered on
  // the stage; a real spread still fills it.
  const { pageW } = fitSpread(avail, aspect, 2, GUTTER_FRAC);

  // Spine geometry: the estimated thickness (interior pages on standard paper) as a fraction
  // of the cover width, used to size the spine panel of the flat cover wrap below.
  const trimWmm = bookSizeOrDefault(bookSize).widthMm;
  const spineMm = estimateSpineMm(pages.length + 2, "standard");
  const spineFrac = spineMm / trimWmm;
  const spineTitle = effectiveSpineTitle(spine, frontCover, activeName);

  // The flat cover wrap (#2): back cover | spine | front cover, laid out as it prints, so the
  // spine is visible in context with its title. The cover panels keep the book aspect; the
  // spine is proportional but floored (SPINE_MIN) so its vertical title stays legible even for
  // a thin book. The whole wrap is fitted to the stage (height first, then shrunk for width).
  const SPINE_MIN = 20;
  const renderCoverWrap = () => {
    if (avail.w <= 0 || avail.h <= 0) return null;
    let coverW = avail.h * aspect;
    let spineW = Math.max(SPINE_MIN, spineFrac * coverW);
    if (2 * coverW + spineW > avail.w) {
      coverW = (avail.w - SPINE_MIN) / 2;
      spineW = Math.max(SPINE_MIN, spineFrac * coverW);
      if (spineFrac * coverW > SPINE_MIN) {
        coverW = avail.w / (2 + spineFrac);
        spineW = spineFrac * coverW;
      }
    }
    const coverH = coverW / aspect;
    const coverPaper = (which: "back" | "front") => {
      const cover = covers[which];
      return (
        <PreviewPaper
          kind="cover"
          pageW={coverW}
          bookSize={bookSize}
          title={cover.title}
          subtitle={cover.subtitle}
          whitespace={cover.whitespace}
          photo={coverPreviewPhoto(cover)}
        />
      );
    };
    return (
      <div className="relative flex items-stretch overflow-hidden rounded-[5px]" style={{ boxShadow: BOOK_SHADOW }}>
        {coverPaper("back")}
        {/* The spine: a bound edge between the two covers, shaded at both folds, title vertical. */}
        <div className="relative shrink-0 overflow-hidden bg-paper" style={{ width: `${spineW}px`, height: `${coverH}px` }}>
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to right, rgba(0,0,0,0.16), rgba(0,0,0,0.03) 22%, rgba(0,0,0,0.03) 78%, rgba(0,0,0,0.16))" }}
          />
          {spineW >= 14 && spineTitle && (
            <div className="absolute inset-0 flex items-center justify-center px-[1px]">
              <span
                className="max-h-[86%] overflow-hidden whitespace-nowrap font-album text-[10px] tracking-wide"
                style={{ writingMode: "vertical-rl", color: "var(--album-ink-soft)" }}
              >
                {spineTitle}
              </span>
            </div>
          )}
        </div>
        {coverPaper("front")}
      </div>
    );
  };

  const renderLeaf = (leaf: Leaf) => {
    if (leaf.kind === "page") {
      const page = pages.find((p) => p.id === leaf.pageId);
      if (!page) return null;
      return (
        <PreviewPaper
          kind="page"
          pageW={pageW}
          bookSize={bookSize}
          title={page.title}
          subtitle={page.subtitle ?? ""}
          layoutId={page.layoutId}
          whitespace={page.whitespace}
          photos={pagePreviewPhotos(page.photoIds)}
          fullPage={page.fullPage}
          focus={page.fullPageFocus}
          placement={page.placement}
        />
      );
    }
    const cover = covers[leaf.face];
    // A standalone cover leaf shows the cover at page scale (#2); the spine lives in the
    // dedicated cover-wrap spread (index 0), not on every cover.
    return (
      <PreviewPaper
        kind="cover"
        pageW={pageW}
        bookSize={bookSize}
        title={cover.title}
        subtitle={cover.subtitle}
        whitespace={cover.whitespace}
        photo={coverPreviewPhoto(cover)}
      />
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[rgb(15,18,22)]">
      {/* Header: label, counter, close */}
      <div className="flex items-center gap-4 px-5 py-3 text-white/90">
        <span className="font-display text-[14px]">Book preview</span>
        <span className="text-[12.5px] text-white/55">{spread ? spreadLabel(spread) : "Cover"}</span>
        <span className="ml-auto font-mono text-[12px] tabular-nums text-white/55">
          {clampedIndex + 1} / {spreadCount}
        </span>
        <button
          onClick={onClose}
          title="Close preview (Esc)"
          className="ml-2 flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 text-white/80 hover:bg-white/10"
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_168px]">
        {/* Stage: the current spread, maximized. Clicking the backdrop closes. */}
        <div className="relative min-h-0">
          <button
            aria-label="Close preview"
            className="absolute inset-0 cursor-default"
            onClick={onClose}
          />

          <button
            onClick={() => go(-1)}
            disabled={clampedIndex === 0}
            aria-label="Previous spread"
            className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/30 text-white/85 hover:bg-black/50 disabled:opacity-25"
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <button
            onClick={() => go(1)}
            disabled={clampedIndex === spreadCount - 1}
            aria-label="Next spread"
            className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/30 text-white/85 hover:bg-black/50 disabled:opacity-25"
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <div ref={stageRef} className="pointer-events-none absolute inset-0 flex items-center justify-center p-10">
            {isWrap
              ? renderCoverWrap()
              : pageW > 0 && spread && (
                  <div className="relative overflow-hidden rounded-[5px]" style={{ boxShadow: BOOK_SHADOW }}>
                    <div className="flex items-stretch">
                      {spread.map((leaf) => (
                        <div key={leaf.kind === "page" ? leaf.pageId : leaf.face}>{renderLeaf(leaf)}</div>
                      ))}
                    </div>
                    {spread.length === 2 && (
                      <>
                        {/* Gutter shadow: pages curve into the binding at the spine. */}
                        <div
                          className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2"
                          style={{
                            width: `${0.16 * pageW}px`,
                            background:
                              "linear-gradient(to right, rgba(0,0,0,0), rgba(0,0,0,0.16) 42%, rgba(0,0,0,0.26) 50%, rgba(0,0,0,0.16) 58%, rgba(0,0,0,0))",
                          }}
                        />
                        {/* The fold itself. */}
                        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-black/25" />
                      </>
                    )}
                  </div>
                )}
          </div>
        </div>

        {/* Right rail: the cover wrap, then every leaf in booklet order, click to jump. */}
        <div className="min-h-0 overflow-y-auto border-l border-white/10 bg-black/20 px-3 py-3">
          <div className="flex flex-col gap-2.5">
            {/* Cover wrap (index 0): a mini back | spine | front. */}
            <button
              onClick={() => setIndex(0)}
              className="flex flex-col gap-1 text-left outline-none"
              title="Go to the cover wrap"
            >
              <span className={`px-0.5 text-[10.5px] ${isWrap ? "font-medium text-white" : "text-white/45"}`}>Cover</span>
              <div className={`overflow-hidden rounded-[3px] ${isWrap ? "ring-2 ring-accent" : "ring-1 ring-white/10"}`}>
                <div className="flex items-stretch">
                  <div className="flex-1">
                    <Thumb photos={coverThumbPhotos(backCover)} layoutId="single" whitespace={backCover.whitespace} bookSize={bookSize} />
                  </div>
                  <div className="w-[3px] shrink-0 bg-black/20" />
                  <div className="flex-1">
                    <Thumb photos={coverThumbPhotos(frontCover)} layoutId="single" whitespace={frontCover.whitespace} bookSize={bookSize} />
                  </div>
                </div>
              </div>
            </button>
            {leaves.map((leaf) => {
              const active = spread ? spread.includes(leaf) : false;
              const targetIdx = spreadIndexOfLeaf(spreads, (l) => l === leaf) + 1;
              const thumb =
                leaf.kind === "page"
                  ? (() => {
                      const page = pages.find((p) => p.id === leaf.pageId);
                      return page ? (
                        <Thumb photos={pageThumbPhotos(page.photoIds)} layoutId={page.layoutId} whitespace={page.whitespace} bookSize={bookSize} fullPage={page.fullPage} focus={page.fullPageFocus} placement={page.placement} />
                      ) : null;
                    })()
                  : (() => {
                      const cover = covers[leaf.face];
                      return <Thumb photos={coverThumbPhotos(cover)} layoutId="single" whitespace={cover.whitespace} bookSize={bookSize} />;
                    })();
              return (
                <button
                  key={leaf.kind === "page" ? leaf.pageId : leaf.face}
                  onClick={() => setIndex(targetIdx)}
                  className="flex flex-col gap-1 text-left outline-none"
                  title={`Go to ${leaf.label}`}
                >
                  <span className={`px-0.5 text-[10.5px] ${active ? "font-medium text-white" : "text-white/45"}`}>
                    {leaf.label}
                  </span>
                  <div className={`rounded-[3px] ${active ? "ring-2 ring-accent" : "ring-1 ring-white/10"}`}>{thumb}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
