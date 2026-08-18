import { useEffect, useRef } from "react";
import { useAlbum } from "./store";
import { useApplyTheme } from "./useApplyTheme";
import { TopBar } from "./components/TopBar";
import { Library } from "./components/Library";
import { PageCard } from "./components/PageCard";
import { CoverCard } from "./components/CoverCard";

export function App() {
  const { photos, pages, addPage, importFiles, loadDemo, initProjects, ready, persistent } =
    useAlbum();
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
      <div className="grid min-h-0 grid-cols-[274px_1fr] max-[760px]:grid-cols-1">
        <Library />

        <main className="min-h-0 overflow-y-auto px-8 pb-24 pt-8">
          {hasPhotos ? (
            <div className="mx-auto flex max-w-[620px] flex-col gap-8">
              <CoverCard which="front" />
              <CoverCard which="insideFront" />
              {pages.map((page, i) => (
                <PageCard key={page.id} page={page} index={i} />
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
              <CoverCard which="insideBack" />
              <CoverCard which="back" />
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
      </div>
    </div>
  );
}
