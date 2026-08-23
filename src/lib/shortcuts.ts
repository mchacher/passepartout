// Keyboard shortcuts (spec 037), pure. Which keystroke means what, and how to spell it for a
// tooltip, kept out of the components so both the hook and the buttons read one definition.

/** A Mac spells the modifier Cmd and everyone else Ctrl. */
const isMac = (platform: string): boolean => /mac|iphone|ipad|ipod/i.test(platform);

export const MODIFIER = isMac(typeof navigator === "undefined" ? "" : navigator.platform) ? "Cmd" : "Ctrl";
export const UNDO_HINT = `${MODIFIER}+Z`;
export const REDO_HINT = `${MODIFIER}+Shift+Z`;

/** The keystroke, reduced to what matters. */
export interface Keystroke {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

export type ShortcutAction = "undo" | "redo" | null;

/**
 * What a keystroke means. Ctrl or Cmd plus Z undoes, and adding Shift redoes; Ctrl+Y redoes
 * too, for the Windows habit. Anything else is not ours and must be left alone.
 */
export function shortcutFor(e: Keystroke): ShortcutAction {
  if (!e.ctrlKey && !e.metaKey) return null;
  const key = e.key.toLowerCase();
  if (key === "z") return e.shiftKey ? "redo" : "undo";
  if (key === "y" && !e.shiftKey) return "redo";
  return null;
}
