import { useEffect } from "react";
import { useAlbum } from "./store";
import { colorThemeOrDefault, fontThemeOrDefault } from "./lib/themes";
import { themeCssVars, type ColorMode } from "./lib/theme-vars";

// Impure companion to src/lib/theme-vars.ts: write the active project's theme onto
// document.documentElement as CSS custom properties, and re-apply the accent variant
// when the OS light/dark preference flips. The pure mapping (theme -> vars) is unit
// tested; this hook only wires it to the store and the DOM.
export function useApplyTheme(): void {
  const colorTheme = useAlbum((s) => s.colorTheme);
  const fontTheme = useAlbum((s) => s.fontTheme);

  useEffect(() => {
    const color = colorThemeOrDefault(colorTheme);
    const font = fontThemeOrDefault(fontTheme);
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const mode: ColorMode = mql.matches ? "dark" : "light";
      const root = document.documentElement;
      for (const [k, v] of Object.entries(themeCssVars(color, font, mode))) {
        root.style.setProperty(k, v);
      }
    };
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, [colorTheme, fontTheme]);
}
