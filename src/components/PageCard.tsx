import { useAlbum } from "../store";
import type { AlbumPage } from "../types";
import { Paper } from "./Paper";

interface PageCardProps {
  page: AlbumPage;
  index: number;
}

// One album page: the control header (title, photo count, delete) plus the
// rendered paper below it.
export function PageCard({ page, index }: PageCardProps) {
  const { setPageTitle, setPageCount, deletePage } = useAlbum();
  const count = page.photoIds.length;

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface-2 shadow-soft">
      <div className="flex items-center gap-3 border-b border-line px-3 py-2.5">
        <span className="whitespace-nowrap font-display text-[13px] text-muted">
          <b className="font-semibold text-accent">{index + 1}</b>
        </span>

        <input
          type="text"
          value={page.title}
          placeholder="Page title (optional)"
          onChange={(e) => setPageTitle(page.id, e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 font-display text-[15px] text-ink placeholder:italic placeholder:text-faint hover:border-line focus:border-accent focus:bg-surface focus:outline-none"
        />

        <div className="flex items-center gap-[3px]">
          <span className="mr-1 text-[11px] text-muted">Photos</span>
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              onClick={() => setPageCount(page.id, n)}
              aria-pressed={count === n}
              className={`h-[26px] w-[26px] rounded-md border font-mono text-xs ${
                count === n
                  ? "border-accent bg-accent text-white"
                  : "border-line bg-surface text-muted"
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        <button
          onClick={() => deletePage(page.id)}
          title="Delete page"
          className="ml-1 flex h-[27px] w-[27px] items-center justify-center rounded-md text-faint hover:bg-surface hover:text-ink"
        >
          <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth={1.6}>
            <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7" />
          </svg>
        </button>
      </div>

      <Paper page={page} />
    </div>
  );
}
