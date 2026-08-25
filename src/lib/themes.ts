import { shippedFontById, type ShippedFontId } from "./fonts";

// Album theme catalog (pure, framework-free), the same shape as the layout catalog
// in src/lib/layouts.ts: a small versioned set of curated options a project picks by
// id. Two independent axes, each a project-level choice (see src/lib/project.ts):
//
//   - a FONT applied to the text painted on the album (cover + page titles, captions)
//   - a COLOR theme: the album's print colors (paper + ink) plus an accent that also
//     recolors the app chrome.
//
// A font STYLE does not carry a font: it names a family from the shipped catalog
// (src/lib/fonts.ts), whose file the browser and the PDF painter both read. Before spec
// 040 these were system stacks, which a PDF cannot embed, so the export substituted
// Times / Helvetica / Courier and three of the five styles printed identically (issue
// #99). The app still fetches nothing: the files ship with it.
//
// Print colors (paper/ink) are single fixed values because they model the physical page;
// the accent carries a light/dark pair so the chrome stays legible in either OS theme.

// ---------------------------------------------------------------------------
// Fonts
// ---------------------------------------------------------------------------

export type FontThemeId =
  | "serif"
  | "sans"
  | "humanist"
  | "rounded"
  | "typewriter"
  | "display"
  | "hand";

export interface FontTheme {
  id: FontThemeId;
  /** The style's own name (the voice), which is what the picker labels it with. */
  name: string;
  /** The shipped family this style is set in (src/lib/fonts.ts). */
  family: ShippedFontId;
}

// The five historical ids keep their voice, now in a real file: Georgia becomes Garamond,
// system-ui becomes Lato, Optima becomes Cabin, SF Pro Rounded becomes Quicksand, Rockwell
// becomes Courier Prime. Ids never change, so every stored project keeps its style with no
// migration; only the typeface it is set in does. `display` and `hand` are new (spec 040):
// their files were already shipped for notes.
export const FONT_THEMES: FontTheme[] = [
  { id: "serif", name: "Serif", family: "garamond" },
  { id: "sans", name: "Sans", family: "lato" },
  { id: "humanist", name: "Humanist", family: "cabin" },
  { id: "rounded", name: "Rounded", family: "quicksand" },
  { id: "typewriter", name: "Typewriter", family: "courier" },
  { id: "display", name: "Display", family: "playfair" },
  { id: "hand", name: "Handwritten", family: "caveat" },
];

/** The CSS font-family value for an album style, from its shipped family. */
export function fontThemeStack(theme: FontTheme): string {
  return shippedFontById(theme.family).stack;
}

/** The real typeface a style is set in, shown under its name in the picker. */
export function fontThemeTypeface(theme: FontTheme): string {
  return shippedFontById(theme.family).name;
}

export const DEFAULT_FONT_THEME: FontThemeId = "serif";

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

export type ColorThemeId = "classic" | "warm" | "slate" | "sage" | "ink";

/** An accent color with a variant for each OS theme, so the chrome stays legible. */
export interface AccentSet {
  light: string;
  dark: string;
}

export interface ColorTheme {
  id: ColorThemeId;
  name: string;
  /** Album page background (a fixed print color, same in light and dark). */
  paper: string;
  /** Album primary text: titles. */
  ink: string;
  /** Album secondary text: subtitles and captions. */
  inkSoft: string;
  /** Chrome + album accent (buttons, active toggles, focus, brand dot). */
  accent: AccentSet;
  accentInk: AccentSet;
  accentSoft: AccentSet;
}

// `classic` reproduces today's exact values (white paper, #1C2226 / #4A5157 text,
// the blue-slate accent from src/index.css), so the defaults change nothing.
export const COLOR_THEMES: ColorTheme[] = [
  {
    id: "classic",
    name: "Classic",
    paper: "#ffffff",
    ink: "#1C2226",
    inkSoft: "#4A5157",
    accent: { light: "#37596b", dark: "#7fa9bd" },
    accentInk: { light: "#2a4653", dark: "#a6c7d6" },
    accentSoft: { light: "#e4ecef", dark: "#26333b" },
  },
  {
    id: "warm",
    name: "Warm",
    paper: "#FBF7F0",
    ink: "#2A211A",
    inkSoft: "#6B5E52",
    accent: { light: "#B15C38", dark: "#D9906F" },
    accentInk: { light: "#8F4526", dark: "#E8B39A" },
    accentSoft: { light: "#F3E6DD", dark: "#3A2A22" },
  },
  {
    id: "slate",
    name: "Slate",
    paper: "#F1F3F5",
    ink: "#1E2A33",
    inkSoft: "#556270",
    accent: { light: "#3E6E8E", dark: "#86B4CF" },
    accentInk: { light: "#2F566F", dark: "#AAD0E3" },
    accentSoft: { light: "#E1E9EE", dark: "#233642" },
  },
  {
    id: "sage",
    name: "Sage",
    paper: "#F2F4EF",
    ink: "#232A22",
    inkSoft: "#58604F",
    accent: { light: "#5A6E43", dark: "#A6BE86" },
    accentInk: { light: "#45542F", dark: "#C4D6AC" },
    accentSoft: { light: "#E7ECDF", dark: "#2B331F" },
  },
  {
    id: "ink",
    name: "Ink",
    paper: "#FCFCFA",
    ink: "#14181B",
    inkSoft: "#4C555C",
    accent: { light: "#2E3A42", dark: "#9BB0BD" },
    accentInk: { light: "#1E272D", dark: "#C0D0DA" },
    accentSoft: { light: "#E7EBED", dark: "#232B30" },
  },
];

export const DEFAULT_COLOR_THEME: ColorThemeId = "classic";

// ---------------------------------------------------------------------------
// Coercion (backward compatibility)
// ---------------------------------------------------------------------------

/** The font theme for an id, or the default for an unknown / missing id. */
export function fontThemeOrDefault(id: string | undefined | null): FontTheme {
  return (
    FONT_THEMES.find((t) => t.id === id) ??
    FONT_THEMES.find((t) => t.id === DEFAULT_FONT_THEME)!
  );
}

/** The color theme for an id, or the default for an unknown / missing id. */
export function colorThemeOrDefault(id: string | undefined | null): ColorTheme {
  return (
    COLOR_THEMES.find((t) => t.id === id) ??
    COLOR_THEMES.find((t) => t.id === DEFAULT_COLOR_THEME)!
  );
}
