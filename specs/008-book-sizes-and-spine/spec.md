# 008 - Book sizes + spine (print preparation)

## Context

Passepartout is meant to end in a printed book (Blurb first). Two things block a
faithful, print-ready export today, and this spec prepares both so the export
(spec 009) can be built on solid ground:

1. **Page size is abstract.** `PageFormat` (square / landscape / portrait) uses
   A-series ratios (1, 1.414, 0.707) that match no real Blurb trim size. A
   Blurb-compliant PDF page must be an exact Blurb trim size, so the on-screen page
   must adopt that size's ratio (what you see is what prints).
2. **There is no spine.** A book cover is a wrap of back + spine + front, but the
   model has only four flat faces. The spine normally repeats the cover title.

This is **phase 1 of the print work**; phase 2 (spec 009) generates the actual
cover-wrap + interior PDFs at 300 DPI. No PDF is produced here.

## Goals

- Replace the abstract `format` with a **book size**: a curated set of real Blurb
  photo-book trim sizes. The chosen size's ratio drives the page and cover preview,
  so preview equals print. Physical dimensions (mm) live on the size for phase 2.
- Add a **spine** to the project: an editable spine title that **defaults to the
  front cover title** and can be overridden. A vertical spine preview shows how it
  will read on the printed book.
- Migrate existing projects: an old `format` maps to the matching Blurb size, and a
  project with no spine defaults to an empty (auto) spine. Nothing crashes.

## Non-goals

- No PDF export, no bleed/DPI rendering, no spine-width math beyond what a preview
  needs (all in spec 009).
- No change to the layout engine. Adopting a real ratio only feeds a different
  `contentW/contentH` into the same `computeLayout`; photos stay contain-fit.
- No per-page size. Book size is one project-level choice (altitude of the old
  `format`).

## The one rule

Untouched. Changing the page ratio only changes the content box the engine fills;
`computeLayout` still contain-fits every photo (ratio preserved, no clip). The spine
shows text only. `src/lib/layout.ts` is not modified.

## Requirements

### Data model

- New pure module `src/lib/book-sizes.ts` (mirrors `themes.ts` / `text-sizes.ts`):
  - `BookSizeId` union + `interface BookSize { id; name; provider; widthMm; heightMm;
    orientation }` where `orientation` is `square | portrait | landscape`.
  - `BOOK_SIZES` catalog, the five Blurb photo-book sizes:

    | id                     | name               | mm (w x h)     | ratio |
    | ---------------------- | ------------------ | -------------- | ----- |
    | blurb-square-7         | Small Square 7x7   | 177.8 x 177.8  | 1.000 |
    | blurb-square-12        | Large Square 12x12 | 304.8 x 304.8  | 1.000 |
    | blurb-portrait-8x10    | Portrait 8x10      | 203.2 x 254.0  | 0.800 |
    | blurb-landscape-10x8   | Landscape 10x8     | 254.0 x 203.2  | 1.250 |
    | blurb-landscape-13x11  | Large Landscape    | 330.2 x 279.4  | 1.182 |

  - `ratioOf(size) = widthMm / heightMm`.
  - Print constants for phase 2 to reuse: `BLEED_MM = 3.175`, `SAFE_MM = 6.35`,
    `PRINT_DPI = 300`.
  - `DEFAULT_BOOK_SIZE = "blurb-square-7"` (ratio 1.0, so existing square projects are
    visually unchanged).
  - `bookSizeOrDefault(id)`: unknown / missing id -> default (backward compat).
  - `bookSizeForLegacyFormat(format)`: `square -> blurb-square-7`,
    `portrait -> blurb-portrait-8x10`, `landscape -> blurb-landscape-10x8`.
- `src/types.ts`: add `interface Spine { title: string }` (empty title = use the front
  cover title). `PageFormat` / `PAGE_ASPECT` stay only as the legacy shape the migration
  reads; components stop using them.
- Project (`src/lib/project.ts`): `ProjectDoc` / `ProjectState` gain
  `bookSize: BookSizeId` and `spine: Spine`, replacing `format`. `serializeProject`
  carries them; `duplicateDoc` carries them; `newProjectDoc` defaults
  (`DEFAULT_BOOK_SIZE`, `{ title: "" }`). A doc read with an old `format` and no
  `bookSize` migrates via `bookSizeForLegacyFormat`; a doc with no `spine` gets the
  default.

### Store

- Root state: `bookSize: BookSizeId` (replaces `format`) and `spine: Spine`.
- Actions: `setBookSize(id)` (replaces `setFormat`), `setSpineTitle(title)`.
- `openProject` migrates a legacy doc; `createProject` / delete-last reset to defaults.
- A pure helper `effectiveSpineTitle(spine, frontCover)` = `spine.title.trim()` or, when
  empty, `frontCover.title.trim()`.

### UI

- Components that read the page ratio switch from `PAGE_ASPECT[format]` to
  `ratioOf(bookSizeOrDefault(bookSize))`: `Paper`, `CoverCard`, `Thumb` (via `PageRail`).
- `TopBar`: the `Format` button group becomes a **Size** dropdown listing the five
  Blurb sizes (name + cm), calling `setBookSize`. Mirrors the `ProjectMenu` /
  `ThemeMenu` dropdown pattern.
- New `SpineCard` in the cover area: a spine-title input (placeholder "Spine title
  (defaults to the cover title)") and a **vertical spine preview** showing the effective
  title, in the album font and ink. Empty input shows the cover title, greyed as a hint.

## Acceptance criteria

- [x] Choosing a book size changes the page and cover preview to that size's exact
      ratio; the size persists and is carried by duplication.
- [x] The five Blurb sizes are offered with their cm dimensions; square stays 1:1.
- [x] The spine shows the front cover title by default and an override when typed; the
      spine value persists and duplicates.
- [x] A project saved before this feature opens with its `format` mapped to the right
      Blurb size and an empty (auto) spine, no crash.
- [x] No photo is cropped or distorted when the ratio changes; a portrait stays
      portrait, a panorama stays a panorama.
- [x] `computeLayout` / `src/lib/layout.ts` unchanged; ratio/fit tests stay green.

## Edge cases

- **Legacy doc** with `format` only: migrated to the matching Blurb size; unknown
  `format` -> default size.
- **Legacy doc** without `spine`: default `{ title: "" }` (auto = cover title).
- **Empty front cover title AND empty spine title**: spine preview shows nothing (an
  untitled book has a blank spine).
- **Ratio change** on an existing album: pages re-fit at the new ratio, never cropping.
- **No active project**: store resets `bookSize` / `spine` to defaults.
