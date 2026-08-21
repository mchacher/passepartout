import { useRef, useState } from "react";
import { useAlbum } from "../store";

// Trigger a browser download of some bytes as a named file.
function downloadFile(bytes: Uint8Array, name: string): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/zip" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// The project switcher in the top bar: shows the active project name, opens a panel
// to switch between projects and to create / rename / duplicate / delete them, and to
// export / import a project as a portable bundle (spec 021).
export function ProjectMenu() {
  const {
    projects,
    activeId,
    activeName,
    persistent,
    createProject,
    openProject,
    renameProject,
    duplicateProject,
    deleteProject,
    exportBundle,
    importBundle,
    remote,
  } = useAlbum();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const close = () => {
    setOpen(false);
    setEditing(false);
  };

  const startRename = () => {
    setDraft(activeName);
    setEditing(true);
  };

  const commitRename = () => {
    if (activeId) void renameProject(activeId, draft);
    setEditing(false);
  };

  const onDelete = () => {
    if (!activeId) return;
    if (confirm(`Delete project "${activeName}"? This cannot be undone.`)) {
      void deleteProject(activeId);
      close();
    }
  };

  const onExport = async () => {
    if (!activeId || busy) return;
    setBusy(true);
    try {
      const res = await exportBundle();
      if (res) downloadFile(res.bytes, res.name);
    } finally {
      setBusy(false);
    }
  };

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!file || busy) return;
    setBusy(true);
    try {
      const res = await importBundle(file);
      if (res.ok) close();
      else alert(res.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-[6px] text-[12.5px] text-ink hover:border-faint"
        title="Projects"
      >
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
        <span className="max-w-[160px] truncate">{activeId ? activeName : "No project"}</span>
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <>
          <button
            aria-label="Close projects menu"
            className="fixed inset-0 z-20 cursor-default"
            onClick={close}
          />
          <div className="absolute left-0 z-30 mt-1.5 w-[260px] rounded-xl border border-line bg-surface p-1.5 shadow-soft">
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-[11px] uppercase tracking-wide text-faint">Projects</span>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  title="Import an album bundle (.zip) as a new project"
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-50"
                >
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path d="M12 15V3M7 8l5-5 5 5M5 21h14" />
                  </svg>
                  Import
                </button>
                <button
                  onClick={() => {
                    void createProject();
                    close();
                  }}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-accent hover:bg-surface-2"
                >
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  New
                </button>
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              onChange={(e) => void onImportFile(e)}
            />

            <div className="max-h-[240px] overflow-y-auto py-1">
              {projects.length === 0 ? (
                <div className="px-2 py-3 text-center text-[12px] text-faint">
                  No projects yet.
                </div>
              ) : (
                projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      if (p.id !== activeId) void openProject(p.id);
                      close();
                    }}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] ${
                      p.id === activeId ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface-2"
                    }`}
                  >
                    <span className="w-3 shrink-0 text-accent">{p.id === activeId ? "•" : ""}</span>
                    <span className="truncate">{p.name}</span>
                  </button>
                ))
              )}
            </div>

            {activeId && (
              <div className="border-t border-line pt-1.5">
                {editing ? (
                  <div className="flex items-center gap-1 px-1 py-1">
                    <input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename();
                        if (e.key === "Escape") setEditing(false);
                      }}
                      className="min-w-0 flex-1 rounded-md border border-accent bg-surface px-2 py-1 text-[13px] text-ink focus:outline-none"
                    />
                    <button
                      onClick={commitRename}
                      className="rounded-md bg-accent px-2 py-1 text-[12px] text-white"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 px-1">
                    <MenuAction label="Rename" onClick={startRename}>
                      <path d="M4 20h4L18.5 9.5a2.12 2.12 0 0 0-3-3L5 17v3z" />
                    </MenuAction>
                    <MenuAction label="Duplicate" onClick={() => void duplicateProject(activeId)}>
                      <rect x="9" y="9" width="11" height="11" rx="2" />
                      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                    </MenuAction>
                    <MenuAction label="Export" onClick={() => void onExport()}>
                      <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
                    </MenuAction>
                    <MenuAction label="Delete" danger onClick={onDelete}>
                      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7" />
                    </MenuAction>
                  </div>
                )}
              </div>
            )}

            {!persistent && (
              <div className="mt-1 rounded-md bg-surface-2 px-2 py-1.5 text-[11px] leading-snug text-muted">
                Saving is unavailable in this browser; projects live only until you close the tab.
              </div>
            )}

            {/* App version (spec 023). In server mode this lives in the Admin menu (spec 027),
                so show it here only in local mode. */}
            {!remote && (
              <div className="mt-1 px-2 pb-0.5 pt-1 text-right text-[10.5px] text-faint">v{__APP_VERSION__}</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

interface MenuActionProps {
  label: string;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function MenuAction({ label, danger, onClick, children }: MenuActionProps) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 flex-col items-center gap-1 rounded-md px-2 py-1.5 text-[11px] hover:bg-surface-2 ${
        danger ? "text-muted hover:text-ink" : "text-muted hover:text-ink"
      }`}
    >
      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
        {children}
      </svg>
      {label}
    </button>
  );
}
