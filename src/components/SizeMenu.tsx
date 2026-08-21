import { useState } from "react";
import { useAlbum } from "../store";
import { useT } from "../useT";
import { BOOK_SIZES, bookSizeOrDefault } from "../lib/book-sizes";

// The book-size picker in the top bar (same dropdown pattern as ProjectMenu): choose
// the physical print size, which sets the page ratio so the preview matches the print.
export function SizeMenu() {
  const { bookSize, setBookSize } = useAlbum();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const active = bookSizeOrDefault(bookSize);

  const cm = (mm: number) => (mm / 10).toFixed(1).replace(/\.0$/, "");

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-[6px] text-[12.5px] text-ink hover:border-faint"
        title={t("size.menuTitle")}
      >
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
          <rect x="4" y="3" width="16" height="18" rx="1.5" />
          <path d="M8 3v18" />
        </svg>
        <span>{t(`size.${active.id}`)}</span>
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <>
          <button
            aria-label={t("size.closeMenu")}
            className="fixed inset-0 z-20 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-30 mt-1.5 w-[248px] rounded-xl border border-line bg-surface p-1.5 shadow-soft">
            <div className="px-2 py-1 text-[11px] uppercase tracking-wide text-faint">{t("size.blurbHeading")}</div>
            {BOOK_SIZES.map((s) => {
              const selected = active.id === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    setBookSize(s.id);
                    setOpen(false);
                  }}
                  aria-pressed={selected}
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[13px] ${
                    selected ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface-2"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-3 shrink-0 text-accent">{selected ? "•" : ""}</span>
                    <span>{t(`size.${s.id}`)}</span>
                  </span>
                  <span className="font-mono text-[11px] text-faint">
                    {cm(s.widthMm)}x{cm(s.heightMm)} cm
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
