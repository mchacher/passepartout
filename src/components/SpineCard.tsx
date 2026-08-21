import { useAlbum } from "../store";
import { useT } from "../useT";
import { effectiveSpineTitle } from "../lib/project";

// The book spine editor: a title that repeats the front cover title (or the album name)
// by default, with a vertical preview of how it will read on the bound edge.
export function SpineCard() {
  const { spine, frontCover, activeName, setSpineTitle } = useAlbum();
  const { t } = useT();
  const shown = effectiveSpineTitle(spine, frontCover, activeName);
  const isOverride = spine.title.trim().length > 0;
  const source = frontCover.title.trim() ? t("spine.usingCover") : t("spine.usingAlbum");

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface-2 shadow-soft">
      <div className="flex items-center gap-3 border-b border-line px-3 py-2.5">
        <span className="whitespace-nowrap font-display text-[13px] font-semibold text-accent">{t("spine.title")}</span>
        <input
          value={spine.title}
          placeholder={t("spine.placeholder")}
          onChange={(e) => setSpineTitle(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 font-display text-[14px] text-ink placeholder:italic placeholder:text-faint hover:border-line focus:border-accent focus:bg-surface focus:outline-none"
        />
        <span className="whitespace-nowrap text-[11px] text-muted">
          {isOverride ? t("spine.edge") : shown ? source : t("spine.edge")}
        </span>
      </div>

      <div className="paper-hatch flex items-center justify-center p-[22px]">
        {/* A thin vertical strip standing in for the printed spine. */}
        <div
          className="flex h-[150px] w-[30px] items-center justify-center overflow-hidden rounded-sm bg-paper shadow-paper"
          title={t("spine.previewTitle")}
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
              {t("spine.noTitle")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
