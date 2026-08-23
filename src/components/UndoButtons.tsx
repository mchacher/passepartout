import { useAlbum } from "../store";
import { useT } from "../useT";
import { UNDO_HINT, REDO_HINT } from "../lib/shortcuts";

// Undo and redo (spec 037). The keyboard is the fast path; these two make the feature visible
// to someone who never tries a shortcut, and their disabled state says whether there is
// anything left to take back.
export function UndoButtons() {
  const undo = useAlbum((s) => s.undo);
  const redo = useAlbum((s) => s.redo);
  const canUndo = useAlbum((s) => s.undoStack.length > 0);
  const canRedo = useAlbum((s) => s.redoStack.length > 0);
  const { t } = useT();

  const cls =
    "flex h-[26px] w-[26px] items-center justify-center rounded-md border border-line bg-surface-2 text-muted transition-colors hover:border-faint hover:text-ink disabled:cursor-default disabled:border-line disabled:text-faint disabled:opacity-45 disabled:hover:text-faint";

  return (
    <div className="flex items-center gap-1" role="group" aria-label={t("undo.group")}>
      <button
        type="button"
        onClick={undo}
        disabled={!canUndo}
        title={`${t("undo.undo")} (${UNDO_HINT})`}
        aria-label={t("undo.undo")}
        className={cls}
      >
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
          <path d="M9 14L4 9l5-5" />
          <path d="M4 9h11a5 5 0 0 1 0 10h-4" />
        </svg>
      </button>
      <button
        type="button"
        onClick={redo}
        disabled={!canRedo}
        title={`${t("undo.redo")} (${REDO_HINT})`}
        aria-label={t("undo.redo")}
        className={cls}
      >
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
          <path d="M15 14l5-5-5-5" />
          <path d="M20 9H9a5 5 0 0 0 0 10h4" />
        </svg>
      </button>
    </div>
  );
}
