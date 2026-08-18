import { useAlbum } from "../store";
import { effectiveSpineTitle } from "../lib/project";

// The book spine editor: a title that repeats the front cover title by default, with a
// vertical preview of how it will read on the bound edge. The printed spine geometry
// (width from page count + paper) comes in spec 009; this only prepares the text.
export function SpineCard() {
  const { spine, frontCover, setSpineTitle } = useAlbum();
  const shown = effectiveSpineTitle(spine, frontCover);
  const usingCoverTitle = spine.title.trim().length === 0 && shown.length > 0;

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface-2 shadow-soft">
      <div className="flex items-center gap-3 border-b border-line px-3 py-2.5">
        <span className="whitespace-nowrap font-display text-[13px] font-semibold text-accent">Spine</span>
        <input
          value={spine.title}
          placeholder="Spine title (defaults to the cover title)"
          onChange={(e) => setSpineTitle(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 font-display text-[14px] text-ink placeholder:italic placeholder:text-faint hover:border-line focus:border-accent focus:bg-surface focus:outline-none"
        />
        <span className="whitespace-nowrap text-[11px] text-muted">
          {usingCoverTitle ? "using cover title" : "the bound edge of the book"}
        </span>
      </div>

      <div className="paper-hatch flex items-center justify-center p-[22px]">
        {/* A thin vertical strip standing in for the printed spine. */}
        <div
          className="flex h-[150px] w-[30px] items-center justify-center overflow-hidden rounded-sm bg-paper shadow-paper"
          title="Spine preview"
        >
          {shown ? (
            <span
              className="font-album tracking-wide"
              style={{
                writingMode: "vertical-rl",
                transform: "rotate(180deg)",
                fontSize: "12px",
                color: "var(--album-ink)",
                maxHeight: "132px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {shown}
            </span>
          ) : (
            <span className="rotate-180 text-[10px] italic text-faint" style={{ writingMode: "vertical-rl" }}>
              No title
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
