# 005 - Album text size

## Context

Album text renders at fixed sizes: cover title, cover subtitle, page title, and
photo caption each have a hardcoded size (a `clamp()` for the covers/title, a fixed
`10.5px` for captions). Building on the album theme (spec 004), a photographer
should be able to tune how big each kind of text is, so a project can read as bold
and titled or quiet and caption-led. This adds a per-project **text size** control,
three levels per text role, grouped in the same **Style** menu as font and palette.

## Goals

- Three text **roles**, each with an independent size at the project level:
  - **Title** (both the cover title and the page title share this role)
  - **Subtitle** (the cover subtitle)
  - **Caption** (the photo caption)
- Three **levels** per role: Small / Medium / Large. Medium is today's size, so
  defaults change nothing.
- A single **Text size** section in the existing Style menu (the "common menu"):
  one row per role, a Small/Medium/Large segmented control on each.
- Stored per project (`textSizes` on `ProjectDoc`), persisted, duplicated, and
  defaulted for documents saved before this feature.

## Non-goals

- No free numeric input, no per-page or per-photo override. One choice per role for
  the whole album, three discrete levels.
- No new roles beyond title / subtitle / caption. Cover and page titles deliberately
  share the "title" role (a heading is a heading); split later only if asked.
- No layout-engine change. This only scales text; photo size and placement are
  untouched.

## The one rule

Untouched. Text size never imports or changes `computeLayout`, and never crops,
clips, or resizes a photo. A caption or title simply occupies more or less of the
whitespace already around it. `src/lib/layout.ts` and its tests are not modified.

## Requirements

### Data model

- New pure module `src/lib/text-sizes.ts` (mirrors `themes.ts`):
  - `TextRole = "title" | "subtitle" | "caption"`.
  - `TextSizeLevel = "sm" | "md" | "lg"`.
  - `TextSizes = Record<TextRole, TextSizeLevel>`.
  - `TEXT_ROLES` (role + display name), `TEXT_SIZE_LEVELS` (level + short label),
    `SIZE_SCALE: Record<TextSizeLevel, number>` (`sm 0.85`, `md 1`, `lg 1.2`).
  - `DEFAULT_TEXT_SIZES` (all `md`).
  - `textSizesOrDefault(v)`: coerces a missing object or any unknown per-role value
    to `md` (backward compatibility, like `coverOrDefault`).
  - `textScaleVars(sizes)`: pure map to the CSS custom properties
    `--title-scale`, `--subtitle-scale`, `--caption-scale` (the numeric multipliers).
- `textSizes: TextSizes` added to `ProjectDoc`, `ProjectState`, and the store root
  (altitude of `format` / `fontTheme` / `colorTheme`). `newProjectDoc` seeds
  defaults; `serializeProject` carries it; `duplicateDoc` carries it (coerced).

### Application

- `src/index.css` defines `--title-scale`, `--subtitle-scale`, `--caption-scale`
  defaulting to `1` in `:root`.
- `useApplyTheme` also writes the scale vars from the project's `textSizes` (they do
  not depend on OS light/dark).
- The four album text sites multiply their existing size by the role's scale var:
  - Cover title: `calc(clamp(16px, 5cqw, 34px) * var(--title-scale))`.
  - Cover subtitle: `calc(clamp(11px, 2.6cqw, 16px) * var(--subtitle-scale))`.
  - Page title: `calc(clamp(13px, 3.1cqw, 19px) * var(--title-scale))`.
  - Caption: move the fixed `10.5px` to `calc(10.5px * var(--caption-scale))`.

### UI

- A **Text size** section appended to `ThemeMenu`, below Palette: one row per role
  (`Title`, `Subtitle`, `Caption`), each a three-button `S / M / L` segmented control
  bound to the store. The album updates live.
- Store action `setTextSize(role, level)` sets the one role and `scheduleSave()`.

## Acceptance criteria

- [x] Each role's size level persists across a reload and is carried by duplication.
- [x] A project saved before this feature opens at Medium on every role (unchanged).
- [x] Changing Title scales both the cover title and page title; Subtitle scales the
      cover subtitle; Caption scales photo captions; roles are independent.
- [x] No photo changes size, ratio, or position when a text size changes.
- [x] Medium on every role renders exactly like today.
- [x] `computeLayout` / `src/lib/layout.ts` unchanged; ratio/fit tests stay green.

## Edge cases

- **Legacy doc** (no `textSizes`) or an unknown per-role value: coerced to `md`.
- **No active project** (last project deleted): store resets `textSizes` to defaults.
- **Large caption / title**: text grows into the surrounding whitespace; it never
  resizes or crops the photo (the engine still owns photo geometry).
