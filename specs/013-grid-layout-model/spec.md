# 013 - Grid layout model (Phase A: the grid substrate)

## Context

Today a page arrangement is a nested split tree (`LayoutNode` in `src/lib/layouts.ts`: a
`slot`, or a `split` along an axis into weighted children). `computeLayout`
(`src/lib/layout.ts`) walks that tree over the content box and emits one region per slot,
then contain-fits each photo inside its region.

To make future **free placement** (roadmap item 1) rest on the same foundation as the
layout catalog, we replace the split tree with a **uniform grid**. A layout template
becomes a set of cell rectangles on the grid; free placement (a later phase) is the user
editing those same rectangles. One data model, one engine, two editing surfaces.

This spec is **Phase A only**: introduce the grid substrate and re-express the catalog on
it, reproducing today's layouts with no new user-facing feature. Free placement + resize
is Phase B; adjustable grid / overlaps / spreads is Phase C.

Decisions taken (with the maintainer):

- **Fixed, global grid** (not per-page). Resolution **12 x 12**. 12 divides by 2/3/4/6 on
  both axes, so the catalog reproduces halves, thirds, quarters and sixths exactly. Cells
  are non-square on non-square pages (normal for a modular grid; a region is just a region
  and the photo contain-fits inside it).
- **Re-author the whole catalog** freely on the grid. We are in development with nothing
  official yet, so ids may change and the split tree, weights and `HERO` bias are dropped.
  Hero layouts move to the nearest clean split (e.g. 1-beside-2 becomes 8 : 4).
- A page keeps a named `layoutId`; a future custom placement (`placement`) overrides it.
  The field is introduced now and resolved by the engine, but nothing writes it until
  Phase B.

## The one rule (no crop)

The grid only defines **regions**. The engine still contain-fits each photo inside its
region, so `w/h` always equals the photo's ratio and nothing is clipped. A bigger cell
rectangle gives the photo more whitespace, never a crop. The opt-in full-page **Fill**
(spec 012) stays the one exception and is orthogonal (it owns the whole page, ignoring the
grid).

## Goals

- A pure grid model: constants (12 x 12 + gutter), a `CellRect`, and `GridTemplate`.
- The engine places photos from cell rectangles instead of a split tree, keeping
  contain-fit, density fill and a gutter, so screen == print is preserved.
- The catalog (counts 1..6) re-authored as grid templates; `autoCells` for other counts.
- Every consumer (`Paper`, `Thumb`, `PreviewPaper`, `LayoutThumb`, `CoverCard`,
  `print.ts`) renders from the grid with no behaviour change a user would notice (hero
  layouts aside).

## Non-goals

- **No free-placement editor** (Phase B). The `placement` field and its resolution are
  wired, but no UI writes it yet.
- No adjustable grid resolution, overlaps, z-order, or spread-spanning (Phase C).
- No change to whitespace/density, full-page (spec 012), covers text, book sizes, or the
  print pipeline shape.

## Architecture

```
Grid (fixed): GRID_COLS = 12, GRID_ROWS = 12, GRID_GUTTER_FRAC

CellRect { col; row; colSpan; rowSpan }        // half-open cell ranges on the grid
GridTemplate { id; label; count; cells: CellRect[] }   // replaces the split-tree catalog

AlbumPage.layoutId              // a named template (as today)
AlbumPage.placement?: CellRect[]   // present => custom, overrides the template (Phase B)

engine:
  gridRegions(cells, contentW, contentH) -> Rect[]    // tracks + gutter -> one region per cell
  computeLayout(items, contentW, contentH, cells, { density })   // regions -> contain-fit (unchanged)

resolution:
  resolveCells(layoutId, count, placement?) -> CellRect[]
    = placement (if length === count) ?? template.cells (if template.count === count) ?? autoCells(count)
```

Region math (one gutter shows between adjacent cells; internal gutters are absorbed into a
spanning cell, so a full-grid single cell equals the content box):

```
gutter = GRID_GUTTER_FRAC * min(contentW, contentH)
trackW = (contentW - (COLS-1)*gutter) / COLS
trackH = (contentH - (ROWS-1)*gutter) / ROWS
region.x = col*(trackW+gutter);   region.w = colSpan*trackW + (colSpan-1)*gutter
region.y = row*(trackH+gutter);   region.h = rowSpan*trackH + (rowSpan-1)*gutter
```

Files:

- `src/types.ts` (edit): `CellRect`; `AlbumPage.placement?`.
- `src/lib/layouts.ts` (rewrite): `GridTemplate`, the re-authored `CATALOG` on 12 x 12,
  `GRID_COLS/GRID_ROWS/GRID_GUTTER_FRAC`, `autoCells`, `resolveCells`, `layoutsForCount`,
  `getLayout`, `defaultLayoutId`. Remove `LayoutNode`, `split`, `weights`, `HERO`,
  `leafCount`, `autoTemplate`, `resolveNode`.
- `src/lib/layout.ts` (edit): `gridRegions`; `computeLayout` takes `cells: CellRect[]`
  instead of `node`. Contain-fit + density unchanged.
- `src/lib/layout.test.ts`, `src/lib/layouts.test.ts` (rewrite for the grid model).
- `src/components/LayoutThumb.tsx` (rewrite): render `CellRect[]` as SVG rects on a 12 x 12
  viewbox.
- `src/components/Paper.tsx`, `Thumb.tsx`, `PreviewPaper.tsx`, `CoverCard.tsx`,
  `src/lib/print.ts` (edit): call `resolveCells` / pass `cells` to `computeLayout`.
- `src/components/PageCard.tsx` (edit): the picker consumes `GridTemplate` (its `node` prop
  to `LayoutThumb` becomes `cells`). Behaviour unchanged.
- `src/store.ts` (edit): `syncLayout` keeps `placement` valid (drop it when its length no
  longer matches the count); `setPageLayout` clears `placement` (re-selecting a template
  re-attaches). `setPageCount`/`placeOnPage`/`removeFromPage` already re-sync.

## Requirements

1. A fixed 12 x 12 grid with a gutter; `CellRect` regions map to pixels by the formula
   above, then the existing contain-fit + density fill runs unchanged.
2. The catalog for counts 1..6 is re-authored as `GridTemplate`s and visually reproduces
   today's arrangements (hero layouts move to the nearest clean grid split).
3. `resolveCells` returns the page's custom `placement` when valid, else the named
   template's cells, else a balanced `autoCells(count)`.
4. Every renderer (screen, thumbnail, preview, print) places photos from the grid; a
   single-photo page fills the content box exactly as today; covers use one full-grid cell.
5. Selecting a template sets `layoutId` and clears any `placement`; `syncLayout` drops a
   `placement` whose length no longer matches the photo count.
6. The engine stays pure and ratio-preserving; no crop anywhere.

## Acceptance criteria

- [x] The engine places photos from `CellRect[]`; every placed cell has `w/h === ratio`.
- [x] Every region and every photo box stays inside the content box (no overflow); one
      gutter separates adjacent cells; a full-grid single cell equals the content box.
- [x] The catalog reproduces the current layouts (1..6) on the grid; the picker and
      thumbnails render from cells.
- [x] `resolveCells` prefers a valid `placement`, then the template, then `autoCells`.
- [x] Covers, `Paper`, `Thumb`, `PreviewPaper`, book preview and the export PDF all render
      correctly from the grid.
- [x] `setPageLayout` clears `placement`; `syncLayout` drops a stale `placement`.
- [x] `npm run validate` passes (typecheck + lint + tests, including ratio + fit).

## Edge cases

- **1 photo**: single full-grid cell, region === content box (no gutter).
- **Counts > 6** (drag drop): `autoCells(count)` gives a balanced grid arrangement.
- **Unknown `layoutId`**: falls back to `autoCells(count)`.
- **Stale `placement`** (count changed): dropped by `syncLayout`, falls back to the
  template.
- **Full-page (spec 012)**: bypasses the grid entirely; unchanged.
- **Panorama / portrait in any cell**: contain-fit, never cropped, extra space is
  whitespace.
