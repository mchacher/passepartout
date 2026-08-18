// Pure mapping from a resolved album theme to the CSS custom properties that carry
// it. Kept framework-free so it is unit-testable; the impure part (writing these onto
// document.documentElement and reacting to OS theme changes) lives in the useApplyTheme
// hook. `mode` selects the accent variant for the current prefers-color-scheme; the
// album print colors (paper/ink) are fixed and do not depend on it.

import type { ColorTheme, FontTheme } from "./themes";

export type ColorMode = "light" | "dark";

export function themeCssVars(
  color: ColorTheme,
  font: FontTheme,
  mode: ColorMode,
): Record<string, string> {
  return {
    "--album-font": font.stack,
    "--paper": color.paper,
    "--album-ink": color.ink,
    "--album-ink-soft": color.inkSoft,
    "--accent": color.accent[mode],
    "--accent-ink": color.accentInk[mode],
    "--accent-soft": color.accentSoft[mode],
  };
}
