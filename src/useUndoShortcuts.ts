import { useEffect } from "react";
import { useAlbum } from "./store";
import { shortcutFor } from "./lib/shortcuts";

/**
 * Ctrl+Z / Ctrl+Shift+Z on the whole window (spec 037). Mounted once, in App.
 *
 * The shortcut is handled even while a text field has focus: the history coalesces typing per
 * field, so one press takes back the whole title you were editing, and a controlled React
 * input has no dependable native undo of its own to defer to. Any other keystroke, modified or
 * not, is left untouched.
 */
export function useUndoShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const action = shortcutFor(e);
      if (!action) return;
      const { undo, redo, undoStack, redoStack } = useAlbum.getState();
      // Nothing to take back: leave the keystroke to the browser rather than swallow it.
      if (action === "undo" && undoStack.length === 0) return;
      if (action === "redo" && redoStack.length === 0) return;
      e.preventDefault();
      if (action === "undo") undo();
      else redo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
