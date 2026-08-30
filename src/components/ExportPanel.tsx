import { useState } from "react";
import { useAlbum } from "../store";
import { useT } from "../useT";
import { bookSizeOrDefault } from "../lib/book-sizes";
import { exportCoverItem, exportItem } from "../lib/export-items";
import { coverIsEmpty, effectiveSpineTitle } from "../lib/project";
import { mmToPt, PAPERS, type PaperId } from "../lib/print";
import { coverMediaIn, pageMediaIn, roundUpPageCount, spineWidthIn, type PaperFamily } from "../lib/print-provider";
import { coverSpecsFor, providerOrDefault } from "../lib/print-providers";
import { pageSpec } from "../lib/print";
import {
  buildCoverWrapPdf,
  buildInteriorPdf,
  type ExportCoverFace,
  type ExportPageLike,
  type ExportProject,
} from "../lib/pdf-export";
import type { Cover, Photo } from "../types";

// The export panel: pick a cover construction and a paper, review the spine (overridable) and
// download the Blurb-ready cover-wrap and interior PDFs. It also states the dimensions Blurb's
// preflight will demand, so a mismatch shows up here rather than after an upload (issue #114).
// Assembles the pure ExportProject from the store at click time and hands it to the pdf-lib
// builder.

const MM_PER_IN = 25.4;
const round3 = (n: number) => Math.round(n * 1000) / 1000;
export function ExportPanel() {
  const store = useAlbum();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [paper, setPaper] = useState<PaperId>("standard");
  // The provider's default construction; ImageWrap for Blurb, the most ordered photo book.
  const [coverType, setCoverType] = useState<string>("imagewrap");
  const [spineOverride, setSpineOverride] = useState("");
  const [spineContent, setSpineContent] = useState<"title" | "titleSubtitle">("title");
  const [busy, setBusy] = useState<null | "cover" | "interior">(null);
  const [failed, setFailed] = useState(false);

  const size = bookSizeOrDefault(store.bookSize);
  const provider = providerOrDefault(size.provider);
  // An inside cover face the author left entirely blank is not printed (#117), so it does not
  // count towards the block either. One they put a dedication or a photo on does.
  const insideFaces =
    (coverIsEmpty(store.insideFrontCover) ? 0 : 1) + (coverIsEmpty(store.insideBackCover) ? 0 : 1);
  const leaves = store.pages.length + insideFaces;
  // The printer only accepts certain page counts, so the export pads with blank leaves. Show
  // the count that will actually be printed, not the one the album happens to have.
  const interiorCount = roundUpPageCount(provider.pageCount, leaves);
  const oddPadded = interiorCount !== leaves;
  const tooFewPages = interiorCount < provider.pageCount.min;

  const covers = coverSpecsFor(size.provider, size.id);
  const coverSpec = covers.find((c) => c.id === coverType) ?? covers[0];
  const paperFamily: PaperFamily = paper === "standard" ? "standard" : "premium";
  const specSpineMm = coverSpec ? spineWidthIn(coverSpec, paperFamily, interiorCount) * MM_PER_IN : 0;
  // Accept a comma decimal separator (e.g. "8,5") as well as a dot.
  const spineMm = spineOverride.trim() ? Number(spineOverride.replace(",", ".")) : specSpineMm;
  const validSpine = Number.isFinite(spineMm) && spineMm >= 0;

  // What Blurb's preflight will compare the files against. Showing it means a mismatch is
  // visible here rather than after an upload (issue #114).
  const targetPage = pageMediaIn(pageSpec(size));
  const targetCover = coverSpec ? coverMediaIn(pageSpec(size), coverSpec, spineMm / MM_PER_IN) : null;
  const inches = (d: { w: number; h: number }) => `${round3(d.w)} x ${round3(d.h)} in`;

  const photoById = (id: string | null): Photo | undefined =>
    id ? store.photos.find((p) => p.id === id) : undefined;

  // An inside cover face travels in the interior file but is DRAWN as a cover (issue 71):
  // the flag tells the painter to use the cover fractions, scales and band, which is what the
  // editor and the book preview already show.
  const faceToPage = (cover: Cover): ExportPageLike => {
    const p = photoById(cover.photoId);
    return {
      title: cover.title,
      subtitle: cover.subtitle,
      whitespace: cover.whitespace,
      insideCover: true,
      // Notes travel with their face (spec 039), printed over whatever it holds.
      notes: cover.notes,
      layoutId: "single",
      items: p ? [exportCoverItem(p)] : [],
    };
  };

  const faceToCover = (cover: Cover): ExportCoverFace => {
    const p = photoById(cover.photoId);
    return {
      title: cover.title,
      subtitle: cover.subtitle,
      whitespace: cover.whitespace,
      photo: p ? exportCoverItem(p) : null,
      notes: cover.notes,
    };
  };

  const assemble = (): ExportProject => ({
    name: store.activeName,
    size,
    colorTheme: store.colorTheme,
    fontTheme: store.fontTheme,
    textSizes: store.textSizes,
    spineTitle: effectiveSpineTitle(store.spine, store.frontCover, store.activeName),
    spineSubtitle: spineContent === "titleSubtitle" ? store.frontCover.subtitle : "",
    interior: [
      faceToPage(store.insideFrontCover),
      ...store.pages.map((pg) => {
        // Full-page mode frames the photo to the whole page and ignores a per-photo crop on
        // screen; keep the PDF in step by exporting the source ratio and no crop there.
        const fp = !!pg.fullPage && pg.photoIds.length === 1;
        return {
          title: pg.title,
          subtitle: pg.subtitle,
          whitespace: pg.whitespace,
          layoutId: pg.layoutId,
          fullPage: pg.fullPage,
          focus: pg.fullPageFocus,
          placement: pg.placement,
          notes: pg.notes,
          items: pg.photoIds
            .map(photoById)
            .filter((p): p is Photo => p !== undefined)
            .map((p) => exportItem(p, p.caption, fp)),
        };
      }),
      faceToPage(store.insideBackCover),
    ],
    front: faceToCover(store.frontCover),
    back: faceToCover(store.backCover),
  });

  const download = (bytes: Uint8Array, suffix: string) => {
    const safeName = (store.activeName || "album").replace(/[^\w.-]+/g, "-");
    // Copy into a plain ArrayBuffer so the Blob part type is unambiguous.
    const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const blob = new Blob([ab], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeName}-${suffix}.pdf`;
    a.click();
    // Keep the URL alive briefly: some browsers truncate a large download if it is
    // revoked the instant the click returns.
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  // A build that fails must say so: the painter throws rather than handing back an empty
  // document, so without this the user would get a valid-looking PDF with nothing in it.
  const run = async (which: "interior" | "cover", build: () => Promise<Uint8Array>) => {
    setBusy(which);
    setFailed(false);
    try {
      download(await build(), which);
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  };

  const exportInterior = () => run("interior", async () => buildInteriorPdf(assemble()));
  const exportCover = () =>
    run("cover", async () => {
      // The button is disabled without a spec; this keeps the builder honest anyway.
      if (!coverSpec) throw new Error("no Blurb cover specification for this size and cover type");
      return buildCoverWrapPdf(assemble(), coverSpec, mmToPt(spineMm));
    });

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-lg border border-accent bg-accent px-3 py-[7px] text-[12.5px] text-white transition-colors hover:bg-accent-ink"
        title={t("export.buttonTitle")}
      >
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
          <path d="M12 3v12M8 11l4 4 4-4M5 21h14" />
        </svg>
        {t("export.export")}
      </button>

      {open && (
        <>
          <button aria-label={t("export.closePanel")} className="fixed inset-0 z-20 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-30 mt-1.5 w-[300px] rounded-xl border border-line bg-surface p-3 shadow-soft">
            <div className="pb-2 text-[11px] uppercase tracking-wide text-faint">{t("export.heading")}</div>

            <div className="flex items-center justify-between py-1 text-[12.5px]">
              <span className="text-muted">{t("export.bookSize")}</span>
              <span className="text-ink">{t(`size.${size.id}`)}</span>
            </div>
            <div className="flex items-center justify-between py-1 text-[12.5px]">
              <span className="text-muted">{t("export.interiorPages")}</span>
              <span className="font-mono text-ink">{interiorCount}</span>
            </div>
            {oddPadded && <p className="pb-1 text-[10.5px] leading-snug text-faint">{t("export.blankLeaf")}</p>}
            {tooFewPages && (
              <p role="alert" className="pb-1 text-[10.5px] leading-snug text-[#c0392b]">
                {t("export.tooFewPages")}
              </p>
            )}

            <label className="flex items-center justify-between gap-2 py-1 text-[12.5px]">
              <span className="text-muted">{t("export.coverType")}</span>
              <select
                value={coverSpec?.id ?? ""}
                onChange={(e) => setCoverType(e.target.value)}
                className="rounded-md border border-line bg-surface-2 px-2 py-1 text-[12.5px] text-ink focus:border-accent focus:outline-none"
              >
                {covers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {t(c.labelKey)}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center justify-between gap-2 py-1 text-[12.5px]">
              <span className="text-muted">{t("export.paper")}</span>
              <select
                value={paper}
                onChange={(e) => setPaper(e.target.value as PaperId)}
                className="rounded-md border border-line bg-surface-2 px-2 py-1 text-[12.5px] text-ink focus:border-accent focus:outline-none"
              >
                {PAPERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {t(`paper.${p.id}`)}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center justify-between gap-2 py-1 text-[12.5px]">
              <span className="text-muted">{t("export.spineMm")}</span>
              <input
                inputMode="decimal"
                value={spineOverride}
                placeholder={specSpineMm.toFixed(1)}
                onChange={(e) => setSpineOverride(e.target.value)}
                className="w-24 rounded-md border border-line bg-surface-2 px-2 py-1 text-right font-mono text-[12.5px] text-ink focus:border-accent focus:outline-none"
              />
            </label>
            <p className="pb-1 pt-0.5 text-[10.5px] leading-snug text-faint">{t("export.spineHint")}</p>

            <div className="mt-1 border-t border-line pt-1.5">
              <div className="flex items-center justify-between py-0.5 text-[11.5px]">
                <span className="text-muted">{t("export.targetPage")}</span>
                <span className="font-mono text-ink">{inches(targetPage)}</span>
              </div>
              {targetCover && (
                <div className="flex items-center justify-between py-0.5 text-[11.5px]">
                  <span className="text-muted">{t("export.targetCover")}</span>
                  <span className="font-mono text-ink">{inches(targetCover)}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 py-1 text-[12.5px]">
              <span className="text-muted">{t("export.onSpine")}</span>
              <div className="flex gap-0.5 rounded-lg border border-line bg-surface-2 p-[3px]">
                {([
                  { id: "title", key: "export.spineTitle" },
                  { id: "titleSubtitle", key: "export.spineTitleSubtitle" },
                ] as const).map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setSpineContent(o.id)}
                    aria-pressed={spineContent === o.id}
                    className={`rounded-md px-2 py-[3px] text-[11.5px] transition-colors ${
                      spineContent === o.id ? "bg-accent text-white shadow-soft" : "text-muted hover:text-ink"
                    }`}
                  >
                    {t(o.key)}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-1.5 flex gap-2">
              <button
                onClick={exportCover}
                disabled={busy !== null || !validSpine || !coverSpec}
                className="flex-1 rounded-md border border-line-strong bg-surface-2 px-2 py-1.5 text-[12px] text-ink hover:bg-surface disabled:opacity-50"
              >
                {busy === "cover" ? t("export.building") : t("export.coverWrap")}
              </button>
              <button
                onClick={exportInterior}
                disabled={busy !== null}
                className="flex-1 rounded-md border border-accent bg-accent px-2 py-1.5 text-[12px] text-white hover:bg-accent-ink disabled:opacity-50"
              >
                {busy === "interior" ? t("export.building") : t("export.interior")}
              </button>
            </div>
            {failed && (
              <p role="alert" className="mt-2 text-[11px] leading-snug text-[#c0392b]">
                {t("export.failed")}
              </p>
            )}
            <p className="mt-2 text-[10.5px] leading-snug text-faint">{t("export.footer")}</p>
          </div>
        </>
      )}
    </div>
  );
}
