import { describe, it, expect } from "vitest";
import { themeCssVars } from "./theme-vars";
import { colorThemeOrDefault, fontThemeOrDefault, fontThemeStack } from "./themes";

const classic = colorThemeOrDefault("classic");
const warm = colorThemeOrDefault("warm");
const serif = fontThemeOrDefault("serif");

describe("themeCssVars", () => {
  it("maps the light accent variant and the fixed print colors", () => {
    const vars = themeCssVars(classic, serif, "light");
    expect(vars["--paper"]).toBe("#ffffff");
    expect(vars["--album-ink"]).toBe("#1C2226");
    expect(vars["--album-ink-soft"]).toBe("#4A5157");
    expect(vars["--accent"]).toBe(classic.accent.light);
    expect(vars["--album-font"]).toBe(fontThemeStack(serif));
  });

  it("switches only the accent between light and dark, print colors stay fixed", () => {
    const light = themeCssVars(warm, serif, "light");
    const dark = themeCssVars(warm, serif, "dark");
    expect(light["--accent"]).toBe(warm.accent.light);
    expect(dark["--accent"]).toBe(warm.accent.dark);
    expect(light["--accent"]).not.toBe(dark["--accent"]);
    // Paper and ink are print colors: identical regardless of OS mode. The album accent
    // (the ink a note can be written in, spec 039) is one of them.
    expect(dark["--paper"]).toBe(light["--paper"]);
    expect(dark["--album-ink"]).toBe(light["--album-ink"]);
    expect(dark["--album-accent"]).toBe(light["--album-accent"]);
    expect(light["--album-accent"]).toBe(warm.accent.light);
  });

  it("carries the chosen style's shipped font stack", () => {
    const sans = fontThemeOrDefault("sans");
    expect(themeCssVars(classic, sans, "light")["--album-font"]).toBe(fontThemeStack(sans));
    // A shipped family, not a system stack: this is what the PDF can embed (spec 040).
    expect(themeCssVars(classic, sans, "light")["--album-font"]).toContain("Lato");
  });
});
