import { useAlbum } from "../store";
import { useT } from "../useT";

// A slim insertion affordance rendered between page cards (and before the first page), so a
// user can add a fresh page at any position, not just at the end (spec 053). `index` is the
// insertion slot passed straight to store.insertPage. The bar stays faint until hovered so it
// never competes with the page content.
export function InsertPageBar({ index }: { index: number }) {
  const insertPage = useAlbum((s) => s.insertPage);
  const { t } = useT();
  return (
    // Sits in the gap ABOVE the page card (its parent is relative), so it adds no layout
    // height. Faint until the row is hovered; the button itself is always focusable.
    <div className="group absolute inset-x-0 -top-4 z-10 flex h-8 items-center justify-center">
      <button
        type="button"
        onClick={() => insertPage(index)}
        title={t("app.insertPage")}
        aria-label={t("app.insertPage")}
        className="flex items-center gap-2 rounded-full border border-dashed border-transparent bg-surface px-3 py-1 text-[11.5px] text-transparent transition-colors group-hover:border-line-strong group-hover:text-muted hover:!border-accent hover:!text-accent focus-visible:border-accent focus-visible:text-accent"
      >
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M12 5v14M5 12h14" />
        </svg>
        {t("app.insertPage")}
      </button>
    </div>
  );
}
