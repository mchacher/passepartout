import { describe, it, expect } from "vitest";
import {
  COLOR_THEMES,
  DEFAULT_COLOR_THEME,
  DEFAULT_FONT_THEME,
  FONT_THEMES,
  colorThemeOrDefault,
  fontThemeOrDefault,
} from "./themes";

describe("theme catalogs", () => {
  it("has unique font ids and unique color ids", () => {
    const fontIds = FONT_THEMES.map((t) => t.id);
    const colorIds = COLOR_THEMES.map((t) => t.id);
    expect(new Set(fontIds).size).toBe(fontIds.length);
    expect(new Set(colorIds).size).toBe(colorIds.length);
  });

  it("resolves the default ids to a theme in their catalog", () => {
    expect(FONT_THEMES.some((t) => t.id === DEFAULT_FONT_THEME)).toBe(true);
    expect(COLOR_THEMES.some((t) => t.id === DEFAULT_COLOR_THEME)).toBe(true);
  });

  it("every font theme has a non-empty name and stack", () => {
    for (const t of FONT_THEMES) {
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.stack.length).toBeGreaterThan(0);
    }
  });

  it("every color theme has print colors and a light/dark accent set", () => {
    for (const t of COLOR_THEMES) {
      expect(t.paper).toBeTruthy();
      expect(t.ink).toBeTruthy();
      expect(t.inkSoft).toBeTruthy();
      for (const set of [t.accent, t.accentInk, t.accentSoft]) {
        expect(set.light).toBeTruthy();
        expect(set.dark).toBeTruthy();
      }
    }
  });

  it("classic keeps the historical values (defaults must not change the look)", () => {
    const classic = colorThemeOrDefault("classic");
    expect(classic.paper).toBe("#ffffff");
    expect(classic.ink).toBe("#1C2226");
    expect(classic.inkSoft).toBe("#4A5157");
    const serif = fontThemeOrDefault("serif");
    expect(serif.stack).toContain("Georgia");
  });
});

describe("coercion", () => {
  it("returns the matching theme for a valid id", () => {
    expect(fontThemeOrDefault("sans").id).toBe("sans");
    expect(colorThemeOrDefault("warm").id).toBe("warm");
  });

  it("falls back to the default for an unknown or missing id", () => {
    expect(fontThemeOrDefault("nope").id).toBe(DEFAULT_FONT_THEME);
    expect(fontThemeOrDefault(undefined).id).toBe(DEFAULT_FONT_THEME);
    expect(fontThemeOrDefault(null).id).toBe(DEFAULT_FONT_THEME);
    expect(colorThemeOrDefault("nope").id).toBe(DEFAULT_COLOR_THEME);
    expect(colorThemeOrDefault(undefined).id).toBe(DEFAULT_COLOR_THEME);
    expect(colorThemeOrDefault(null).id).toBe(DEFAULT_COLOR_THEME);
  });
});
