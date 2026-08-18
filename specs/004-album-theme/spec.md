# 004 - Album theme (font + color)

## Context

Every album currently renders with a single hardcoded typography and color: all
album text uses the `font-display` serif stack, page and cover titles are painted
in `#1C2226`, subtitles and captions in `#4A5157`, and the paper is always white.
A photographer cannot give a project its own voice. This feature adds two
project-level choices, a **font** and a **color theme** (a limited, curated
palette), so each album can look warm, cool, minimal, and so on.

The choice is stored per project (like `format`), persists across reloads, is
carried by duplication, and defaults so existing projects keep today's exact look.

## Goals

- A per-project **album font**: one choice from a small curated set of system
  fonts (no downloads, the app stays offline). It drives all text painted on the
  album surface: cover titles/subtitles, page titles, captions.
- A per-project **color theme**: one choice from a small curated palette. Each
  theme defines the album's **paper**, **ink** (primary text), and **ink-soft**
  (secondary text) print colors, plus an **accent** that also recolors the app
  chrome (buttons, active toggles, focus rings, brand dot) so the app and the
  album read as one piece.
- Both choices live in `ProjectDoc`, persist, duplicate, and default cleanly for
  documents saved before this feature.
- A picker in the top bar to choose font and palette, with a live preview.

## Non-goals

- No custom/uploaded fonts, no Google Fonts, no color pickers or hex input. The
  point is a small tasteful set, not a full theming engine.
- No per-page or per-cover override. The theme is one choice for the whole album.
- No change to the layout engine, the whitespace model, or anything about how a
  photo is sized or placed. This is text and background styling only.

## The one rule

Untouched. This feature never imports or changes `computeLayout`; it only changes
font family and text/background colors. No code path here can crop, clip, or
resize a photo. `src/lib/layout.ts` and its tests are not modified.

## Requirements

### Data model

- Two new fields at the project level: `fontTheme: FontThemeId` and
  `colorTheme: ColorThemeId`, added to `ProjectDoc`, `ProjectState`, and the store
  `AlbumState` root (matching the altitude of `format`).
- A new pure module `src/lib/themes.ts` owns the catalogs and coercion, the same
  way `src/lib/layouts.ts` owns the layout catalog:
  - `FontThemeId` union + `FONT_THEMES: FontTheme[]` where
    `FontTheme = { id; name; stack }` (`stack` is a CSS `font-family` value built
    from system fonts only).
  - `ColorThemeId` union + `COLOR_THEMES: ColorTheme[]` where
    `ColorTheme = { id; name; paper; ink; inkSoft; accent; accentInk; accentSoft }`.
    `paper`, `ink`, `inkSoft` are single fixed print colors. `accent`,
    `accentInk`, `accentSoft` are each `{ light; dark }` so the chrome accent stays
    legible in both OS themes.
  - `DEFAULT_FONT_THEME` (`"serif"`) and `DEFAULT_COLOR_THEME` (`"classic"`).
  - `fontThemeOrDefault(id)` and `colorThemeOrDefault(id)` returning the matching
    theme, or the default for an unknown / missing id (backward compatibility, the
    same pattern as `coverOrDefault`).

Catalog (limited by design):

- Fonts (5): `serif` (today's default, unchanged look), `sans`, `humanist`,
  `rounded`, `typewriter`. Each is a graceful system-font stack.
- Colors (5): `classic` (white paper, near-black ink, blue-slate accent = today's
  exact values), `warm` (cream paper), `slate` (cool grey paper), `sage` (soft
  green paper), `ink` (bright paper, monochrome graphite accent). Papers stay
  subtle so photos still read true.

### Application

- The active theme is applied by setting CSS custom properties on
  `document.documentElement` from a small effect driven by the store's
  `colorTheme` / `fontTheme`:
  - `--album-font` = the font stack.
  - `--paper`, `--album-ink`, `--album-ink-soft` = the theme's print colors.
  - `--accent`, `--accent-ink`, `--accent-soft` = the theme's accent for the
    current `prefers-color-scheme`, re-applied when the OS theme flips
    (`matchMedia` listener).
- `src/index.css` defines defaults for the new `--album-ink`, `--album-ink-soft`,
  `--album-font` vars so first paint (before the effect runs) matches the classic
  theme.
- Tailwind gains a `font-album` utility mapped to `var(--album-font)`.
- Album text swaps from hardcoded values to the vars (exact sites in `plan.md`):
  cover title/subtitle (`CoverCard.tsx`), page title and caption (`Paper.tsx`).
  Chrome typography (top bar brand, library heading, editor labels/inputs) keeps
  the app `font-display`: the font choice is the album's, not the app's.

### UI

- A new `ThemeMenu.tsx` in the top bar (mirrors `ProjectMenu`'s dropdown pattern):
  a button opening a panel with a **Font** section (each option previewed in its
  own stack) and a **Palette** section (swatch per theme showing paper + ink +
  accent chips). The active option is marked; clicking calls the store action and
  the album + chrome update live.
- Store actions `setFontTheme(id)` and `setColorTheme(id)` set the field and
  `scheduleSave()`.

## Acceptance criteria

- [x] A project remembers its font and color theme across a reload.
- [x] Duplicating a project carries both choices.
- [x] A project saved before this feature opens with the classic defaults (no
      crash, look unchanged).
- [x] Choosing a font changes cover titles/subtitles, page titles, and captions,
      and nothing about photo size or placement.
- [x] Choosing a palette changes the album paper + text colors and the app chrome
      accent together, and remains legible in OS light and dark mode.
- [x] The classic + serif defaults render byte-for-byte like today.
- [x] `computeLayout` and `src/lib/layout.ts` are unchanged; ratio/fit tests stay
      green.

## Edge cases

- **Legacy doc** (no `fontTheme` / `colorTheme`): coerced to defaults on open.
- **Unknown id** in a stored doc: coerced to the default theme.
- **No active project** (deleting the last project): store resets font/color to
  defaults so the picker and chrome show the default theme.
- **OS theme flip** while a theme is active: the accent variant re-applies; album
  paper/ink are fixed print colors and intentionally do not change with OS theme.
- **Offline**: all stacks are system fonts, so nothing is fetched.
