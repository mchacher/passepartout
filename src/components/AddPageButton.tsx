import { useAlbum } from "../store";
import { useT } from "../useT";

// The one and only "add a page" affordance (spec issue 62). It is rendered in every gap of
// the page list: before the first page, between each pair, and after the last one. `index`
// is the insertion slot passed straight to store.insertPage, so the button in gap k inserts
// at slot k (slot 0 = before the first page, slot pages.length = append). Always visible and
// identical everywhere: one action, one look, no hover hunting.
export function AddPageButton({ index }: { index: number }) {
  const insertPage = useAlbum((s) => s.insertPage);
  const { t } = useT();
  return (
    <button
      type="button"
      onClick={() => insertPage(index)}
      aria-label={t("app.addPage")}
      className="inline-flex items-center gap-2 self-center rounded-[10px] border border-dashed border-line-strong px-5 py-2.5 text-[12.5px] text-muted hover:border-accent hover:text-accent"
    >
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
        <path d="M12 5v14M5 12h14" />
      </svg>
      {t("app.addPage")}
    </button>
  );
}
