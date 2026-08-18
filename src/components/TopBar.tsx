import { useRef } from "react";
import { useAlbum } from "../store";
import { ProjectMenu } from "./ProjectMenu";
import { ThemeMenu } from "./ThemeMenu";
import { SizeMenu } from "./SizeMenu";
import { ExportPanel } from "./ExportPanel";

export function TopBar() {
  const fileRef = useRef<HTMLInputElement>(null);
  const { importFiles } = useAlbum();

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

      <ExportPanel />
    </header>
  );
}
