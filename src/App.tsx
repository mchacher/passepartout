import { useEffect, useRef } from "react";
import { useAlbum } from "./store";
import { useView } from "./viewStore";
import { zoomWidthPx } from "./lib/zoom";
import { useApplyTheme } from "./useApplyTheme";
import { TopBar } from "./components/TopBar";
import { Library } from "./components/Library";
import { PageCard } from "./components/PageCard";
import { CoverCard } from "./components/CoverCard";
import { SpineCard } from "./components/SpineCard";
import { PageRail } from "./components/PageRail";
import { ZoomControl } from "./components/ZoomControl";

export function App() {
  const { photos, pages, addPage, importFiles, loadDemo, initProjects, ready, persistent } =
    useAlbum();
  const zoom = useView((s) => s.zoom);
  const fileRef = useRef<HTMLInputElement>(null);
  const hasPhotos = photos.length > 0;

  useApplyTheme();

  useEffect(() => {
    void initProjects();
  }, [initProjects]);

  if (!ready) {
    return (
      <div className="grid h-screen place-items-center text-[13px] text-muted">
        Loading your projects...
      </div>
    );
  }

  return (
    <div className="grid h-screen grid-rows-[auto_1fr]">
      <div>
        <TopBar />
        {!persistent && (
          <div className="border-b border-line bg-surface-2 px-5 py-1.5 text-center text-[11.5px] text-muted">
            This browser cannot save projects locally, so your work will be lost when you close the tab.
          </div>
        )}
      </div>
      <div className="grid min-h-0 grid-cols-[274px_1fr] xl:grid-cols-[274px_1fr_212px] max-[760px]:grid-cols-1">
        <Library />

        <main className="min-h-0 overflow-y-auto px-8 pb-24 pt-8">
          {hasPhotos ? (
            <div className="mx-auto flex flex-col gap-8" style={{ width: zoomWidthPx(zoom), maxWidth: "100%" }}>
              <div id="cover-front">
                <CoverCard which="front" />
              </div>
              <div id="spine">
                <SpineCard />
              </div>
              <div id="cover-insideFront">
                <CoverCard which="insideFront" />
              </div>
              {pages.map((page, i) => (
                <div id={`page-${page.id}`} key={page.id}>
                  <PageCard page={page} index={i} />
                </div>
              ))}
              <button
                onClick={addPage}
                className="inline-flex items-center gap-2 self-center rounded-[10px] border border-dashed border-line-strong px-5 py-2.5 text-[12.5px] text-muted hover:border-accent hover:text-accent"
              >
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add page
              </button>
              <div id="cover-insideBack">
                <CoverCard which="insideBack" />
              </div>
              <div id="cover-back">
                <CoverCard which="back" />
              </div>
            </div>
          ) : (
            <div className="mx-auto mt-[8vh] max-w-[460px] text-center text-muted">
              <div className="mx-auto mb-[22px] h-[108px] w-[108px] rounded border border-line-strong bg-surface-2 p-3.5 shadow-soft">
                <div className="h-full w-full rounded-sm border border-line bg-gradient-to-br from-accent-soft to-surface" />
              </div>
              <h1 className="mb-2.5 font-display text-[26px] font-medium tracking-tight text-ink">
                Your photos, never cropped.
              </h1>
              <p className="mx-auto mb-[22px] max-w-[380px] text-[13.5px] leading-relaxed">
                Choose, page by page, how many photos to place and which ones. The engine
                arranges them in whitespace, keeping their original framing. There is no
                crop tool: that is the whole point.
              </p>
              <div className="flex justify-center gap-2.5">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="rounded-lg border border-accent bg-accent px-3 py-[7px] text-[12.5px] text-white hover:bg-accent-ink"
                >
                  Import photos
                </button>
                <button
                  onClick={loadDemo}
                  className="rounded-lg border border-line-strong bg-surface-2 px-3 py-[7px] text-[12.5px] hover:bg-surface"
                >
                  Load an example
                </button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) void importFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
          )}
        </main>

        {hasPhotos && <PageRail />}
      </div>

      {hasPhotos && <ZoomControl />}
    </div>
  );
}
