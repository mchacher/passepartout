import { useEffect } from "react";
import { useAlbum } from "./store";
import { colorThemeOrDefault, fontThemeOrDefault } from "./lib/themes";
import { textScaleVars } from "./lib/text-sizes";
import { themeCssVars, type ColorMode } from "./lib/theme-vars";

// Impure companion to src/lib/theme-vars.ts and src/lib/text-sizes.ts: write the
// active project's album style (color theme, font, per-role text sizes) onto
// document.documentElement as CSS custom properties, and re-apply the color accent
// variant when the OS light/dark preference flips. The pure mappings are unit tested;
// this hook only wires them to the store and the DOM. The text-size vars are
// OS-independent but written in the same pass for simplicity.
export function useApplyTheme(): void {
  const colorTheme = useAlbum((s) => s.colorTheme);
  const fontTheme = useAlbum((s) => s.fontTheme);
  const textSizes = useAlbum((s) => s.textSizes);

  useEffect(() => {
    const color = colorThemeOrDefault(colorTheme);
    const font = fontThemeOrDefault(fontTheme);
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const mode: ColorMode = mql.matches ? "dark" : "light";
      const root = document.documentElement;
      const vars = { ...themeCssVars(color, font, mode), ...textScaleVars(textSizes) };
      for (const [k, v] of Object.entries(vars)) {
        root.style.setProperty(k, v);
      }
    };
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, [colorTheme, fontTheme, textSizes]);
}
