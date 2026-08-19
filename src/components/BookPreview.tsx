import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAlbum } from "../store";
import type { Cover, CoverFace } from "../types";
import { bookLeaves, toSpreads, spreadIndexOfLeaf, spreadLabel, fitSpread, type Leaf } from "../lib/preview";
import { bookSizeOrDefault, ratioOf } from "../lib/book-sizes";
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
  } = useAlbum();

  const covers: Record<CoverFace, Cover> = useMemo(
    () => ({ front: frontCover, insideFront: insideFrontCover, insideBack: insideBackCover, back: backCover }),
    [frontCover, insideFrontCover, insideBackCover, backCover],
  );

  const leaves = useMemo(() => bookLeaves(pages.map((p) => p.id)), [pages]);
  const spreads = useMemo(() => toSpreads(leaves), [leaves]);

  const [index, setIndex] = useState(0);
  // Keep the index in range when the book changes (pages added/removed) or on reopen.
  useEffect(() => {
    setIndex((i) => Math.max(0, Math.min(i, spreads.length - 1)));
  }, [spreads.length]);

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
    (delta: number) => setIndex((i) => Math.max(0, Math.min(i + delta, spreads.length - 1))),
    [spreads.length],
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
      .map((p) => ({ id: p.id, url: p.url, ratio: p.ratio, caption: p.caption }));

  const coverPreviewPhoto = (cover: Cover): PreviewPhoto | null => {
    const p = photoById(cover.photoId);
    return p ? { id: p.id, url: p.url, ratio: p.ratio, caption: "" } : null;
  };

  const pageThumbPhotos = (photoIds: string[]): ThumbPhoto[] =>
    photoIds
      .map((id) => photoById(id))
      .filter((p): p is NonNullable<typeof p> => p !== undefined)
      .map((p) => ({ id: p.id, url: p.url, ratio: p.ratio }));

  const coverThumbPhotos = (cover: Cover): ThumbPhoto[] => {
    const p = photoById(cover.photoId);
    return p ? [{ id: p.id, url: p.url, ratio: p.ratio }] : [];
  };

  // Derive a clamped index at render so a shrunk `spreads` (pages removed while open) can
  // never index past the end before the reset effect runs.
  const clampedIndex = Math.min(Math.max(index, 0), spreads.length - 1);
  const spread = spreads[clampedIndex];
  const aspect = ratioOf(bookSizeOrDefault(bookSize));
  const { pageW } = fitSpread(avail, aspect, spread.length === 2 ? 2 : 1, GUTTER_FRAC);

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
        <span className="text-[12.5px] text-white/55">{spreadLabel(spread)}</span>
        <span className="ml-auto font-mono text-[12px] tabular-nums text-white/55">
          {clampedIndex + 1} / {spreads.length}
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
            disabled={clampedIndex === spreads.length - 1}
            aria-label="Next spread"
            className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/30 text-white/85 hover:bg-black/50 disabled:opacity-25"
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <div ref={stageRef} className="pointer-events-none absolute inset-0 flex items-center justify-center p-10">
            {pageW > 0 && (
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

        {/* Right rail: every leaf in booklet order, click to jump. */}
        <div className="min-h-0 overflow-y-auto border-l border-white/10 bg-black/20 px-3 py-3">
          <div className="flex flex-col gap-2.5">
            {leaves.map((leaf) => {
              const active = spread.includes(leaf);
              const targetIdx = spreadIndexOfLeaf(spreads, (l) => l === leaf);
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
