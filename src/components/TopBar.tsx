import { useRef, useState } from "react";
import { useAlbum } from "../store";
import { ProjectMenu } from "./ProjectMenu";
import { ThemeMenu } from "./ThemeMenu";
import { SizeMenu } from "./SizeMenu";
import { ExportPanel } from "./ExportPanel";
import { BookPreview } from "./BookPreview";

export function TopBar() {
  const fileRef = useRef<HTMLInputElement>(null);
  const { importFiles, photos } = useAlbum();
  const [previewOpen, setPreviewOpen] = useState(false);
  const hasPhotos = photos.length > 0;

  return (
    <header className="flex flex-wrap items-center gap-6 border-b border-line bg-surface px-5 py-3">
      <div className="flex items-baseline gap-2.5">
        <span className="font-display text-[21px] tracking-tight">
          Passe<span className="text-accent">·</span>partout
        </span>
        <span className="border-l border-line-strong pl-2.5 text-[11.5px] text-muted">
          layout without cropping
        </span>
      </div>

      <div className="mr-auto self-center">
        <ProjectMenu />
      </div>

      <ThemeMenu />

      <SizeMenu />

      <button
        onClick={() => fileRef.current?.click()}
        className="inline-flex items-center gap-2 rounded-lg border border-line-strong bg-surface-2 px-3 py-[7px] text-[12.5px] transition-colors hover:border-faint hover:bg-surface"
      >
        Import
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
        title={hasPhotos ? "Read through the whole book" : "Import photos to preview the book"}
        className="inline-flex items-center gap-2 rounded-lg border border-line-strong bg-surface-2 px-3 py-[7px] text-[12.5px] transition-colors hover:border-faint hover:bg-surface disabled:opacity-50 disabled:hover:border-line-strong disabled:hover:bg-surface-2"
      >
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
          <path d="M3 5.5A1.5 1.5 0 0 1 4.5 4H10a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4.5A1.5 1.5 0 0 1 3 15.5zM21 5.5A1.5 1.5 0 0 0 19.5 4H14a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h5.5a1.5 1.5 0 0 0 1.5-1.5z" />
        </svg>
        Preview
      </button>

      <ExportPanel />

      <BookPreview open={previewOpen} onClose={() => setPreviewOpen(false)} />
    </header>
  );
}
