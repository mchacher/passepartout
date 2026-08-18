# 006 - Text styles: cover/page split, page subtitle, XL

## Context

Spec 005 gave the album three text-size roles (title, subtitle, caption), where a
single "title" role sized both the cover and the page titles and only the cover had a
subtitle. This spec refines that model: the cover text and the page text are separate
styles, every page gains its own editable subtitle, and a fourth size level (XL) is
added. It supersedes 005's role model (which never shipped to `master`).

## Goals

- **Five text roles**, each an independent project-level size:
  1. **Cover title** (all four cover faces)
  2. **Cover subtitle** (all four cover faces)
  3. **Page title** (content pages)
  4. **Page subtitle** (content pages)
  5. **Caption** (photo captions)
- **Page subtitle** is a new editable field on every page, rendered under the page
  title (contained in whitespace, like the cover subtitle). Covers already have a
  subtitle; this brings the same to pages.
- **Four size levels** per role: Small / Medium / Large / **XL**. Medium stays the
  current size, so defaults are unchanged.
- All controls stay in the one common **Style** menu (one S/M/L/XL row per role).

## Non-goals

- No per-page or per-photo size override; still one choice per role for the album.
- No change to the layout engine, whitespace, or photo geometry.
- No migration code for 005's `{title, subtitle, caption}` sizes: 005 is unmerged and
  unreleased, so old keys simply coerce to defaults (Medium).

## The one rule

Untouched. Adding a page subtitle and more size levels only adds/scales text; no code
path crops, clips, or resizes a photo, and `src/lib/layout.ts` is not modified. A page
subtitle occupies whitespace above the photos exactly as the page title already does.

## Requirements

### Data model

- `src/lib/text-sizes.ts` role model becomes:
  - `TextRole = "coverTitle" | "coverSubtitle" | "pageTitle" | "pageSubtitle" | "caption"`.
  - `TextSizeLevel = "sm" | "md" | "lg" | "xl"`.
  - `SIZE_SCALE`: `sm 0.85`, `md 1`, `lg 1.2`, `xl 1.45`.
  - `TEXT_ROLES` display names: Cover title, Cover subtitle, Page title, Page
    subtitle, Caption. `TEXT_SIZE_LEVELS` adds `xl` (label `XL`).
  - `DEFAULT_TEXT_SIZES`: every role `md`.
  - `textSizesOrDefault` and `textScaleVars` updated to the five roles; the vars are
    `--cover-title-scale`, `--cover-subtitle-scale`, `--page-title-scale`,
    `--page-subtitle-scale`, `--caption-scale`. Coercion still defaults a missing or
    unknown per-role value to `md`.
- `AlbumPage` (`src/types.ts`) gains `subtitle: string` (empty by default). It rides
  through serialize/duplicate with the rest of the page; a page loaded without it is
  normalized to `""` on open (backward compatibility).

### Application

- `src/index.css` defaults the five `--*-scale` vars to `1` in `:root`.
- `useApplyTheme` writes the five scale vars from `textSizes`.
- Text sites multiply their base size by the role var:
  - Cover title `* var(--cover-title-scale)`, cover subtitle `* var(--cover-subtitle-scale)`.
  - Page title `* var(--page-title-scale)`.
  - Page subtitle (new): a base of `clamp(10px, 2.2cqw, 14px)` `* var(--page-subtitle-scale)`,
    in `--album-ink-soft`, under the title.
  - Caption `* var(--caption-scale)`.

### UI

- **PageCard**: a subtitle input under the title input (smaller, same style), bound to
  a new store action `setPageSubtitle(pageId, subtitle)`.
- **Paper**: render the page subtitle under the title when present; widen the photo
  area's top padding when a subtitle is shown so title + subtitle clear the photos.
- **ThemeMenu**: the Text size section shows five rows (the five roles), each a
  four-button `S / M / L / XL` control.

## Acceptance criteria

- [x] Five independent size roles; changing one never moves another.
- [x] Cover title/subtitle size the four cover faces; page title/subtitle size the
      content pages; caption sizes captions.
- [x] Every page has an editable subtitle, rendered under its title, never cropping a
      photo; empty subtitle renders nothing.
- [x] XL is available on every role and scales larger than Large.
- [x] Medium on every role, with empty page subtitles, renders like spec 005's Medium.
- [x] Sizes and the page subtitle persist across reload and are carried by duplication.
- [x] A legacy project (old size keys, pages without a subtitle) opens at Medium with
      empty page subtitles, no crash.
- [x] `computeLayout` / `src/lib/layout.ts` unchanged; ratio/fit tests stay green.

## Edge cases

- **Legacy `textSizes`** with 005's keys or missing: every new role defaults to `md`.
- **Page without `subtitle`** (older doc): normalized to `""` on load.
- **Title + subtitle + XL on a page**: both grow into the top whitespace; the photo
  area padding grows with them, so the engine's photo box only shrinks, never crops.
- **No active project**: store resets `textSizes` to defaults.
