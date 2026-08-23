import { useRef, useState } from "react";
import { useAlbum } from "../store";
import { useView } from "../viewStore";
import { useT } from "../useT";
import { ProjectMenu } from "./ProjectMenu";
import { ThemeMenu } from "./ThemeMenu";
import { SizeMenu } from "./SizeMenu";
import { UndoButtons } from "./UndoButtons";
import { ExportPanel } from "./ExportPanel";
import { BookPreview } from "./BookPreview";
import { UpdatesSheet } from "./UpdatesSheet";
import { AdminMenu } from "./AdminMenu";
import { LanguageMenu } from "./LanguageMenu";

export function TopBar() {
  const fileRef = useRef<HTMLInputElement>(null);
  const { importFiles, photos, remote, versionInfo } = useAlbum();
  const { showGrid, toggleGrid } = useView();
  const { t } = useT();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const hasPhotos = photos.length > 0;
  const updateAvailable = remote && !!versionInfo?.updateAvailable;

  return (
    <header className="flex flex-wrap items-center gap-6 border-b border-line bg-surface px-5 py-3">
      <div className="flex items-baseline gap-2.5">
        <span className="font-display text-[21px] tracking-tight">
          Passe<span className="text-accent">-</span>partout
        </span>
        <span className="border-l border-line-strong pl-2.5 text-[11.5px] text-muted">
          {t("topbar.tagline")}
        </span>
      </div>

      <div className="mr-auto flex items-center gap-2.5 self-center">
        <ProjectMenu />
        <UndoButtons />
      </div>

      <ThemeMenu />

      <SizeMenu />

      <button
        onClick={toggleGrid}
        aria-pressed={showGrid}
        title={showGrid ? t("topbar.hideGrid") : t("topbar.showGrid")}
        className={`inline-flex h-[32px] w-[34px] items-center justify-center rounded-lg border transition-colors ${
          showGrid
            ? "border-accent bg-accent-soft text-accent"
            : "border-line-strong bg-surface-2 text-muted hover:border-faint hover:bg-surface"
        }`}
      >
        <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
          <path d="M3 3h18v18H3zM9 3v18M15 3v18M3 9h18M3 15h18" />
        </svg>
      </button>

      <button
        onClick={() => fileRef.current?.click()}
        className="inline-flex items-center gap-2 rounded-lg border border-line-strong bg-surface-2 px-3 py-[7px] text-[12.5px] transition-colors hover:border-faint hover:bg-surface"
      >
        {t("topbar.import")}
      </button>
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

      <button
        onClick={() => setPreviewOpen(true)}
        disabled={!hasPhotos}
        title={hasPhotos ? t("topbar.previewReady") : t("topbar.previewNoPhotos")}
        className="inline-flex items-center gap-2 rounded-lg border border-line-strong bg-surface-2 px-3 py-[7px] text-[12.5px] transition-colors hover:border-faint hover:bg-surface disabled:opacity-50 disabled:hover:border-line-strong disabled:hover:bg-surface-2"
      >
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
          <path d="M3 5.5A1.5 1.5 0 0 1 4.5 4H10a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4.5A1.5 1.5 0 0 1 3 15.5zM21 5.5A1.5 1.5 0 0 0 19.5 4H14a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h5.5a1.5 1.5 0 0 0 1.5-1.5z" />
        </svg>
        {t("topbar.preview")}
      </button>

      <ExportPanel />

      {updateAvailable && (
        <button
          onClick={() => setUpdatesOpen(true)}
          title={t("topbar.updateAvailable", { version: versionInfo?.latest ?? "" })}
          className="inline-flex items-center gap-1.5 rounded-lg border border-accent bg-accent-soft px-3 py-[7px] text-[12.5px] text-accent transition-colors hover:bg-accent hover:text-white"
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
          {t("topbar.update")}
        </button>
      )}

      <LanguageMenu />

      {remote && <AdminMenu />}

      <BookPreview open={previewOpen} onClose={() => setPreviewOpen(false)} />
      <UpdatesSheet open={updatesOpen} onClose={() => setUpdatesOpen(false)} />
    </header>
  );
}
