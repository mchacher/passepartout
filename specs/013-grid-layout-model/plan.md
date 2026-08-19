# 013 Phase A - Implementation plan

## Steps (in order)

1. **Types** (`src/types.ts`):
   - `export interface CellRect { col: number; row: number; colSpan: number; rowSpan: number }`
   - `AlbumPage.placement?: CellRect[]` (doc comment: present => custom placement overriding
     the named template; Phase B writes it; effective only when its length === photo count).

2. **Catalog + resolution** (`src/lib/layouts.ts`, rewrite):
   - `GRID_COLS = 12`, `GRID_ROWS = 12`, `GRID_GUTTER_FRAC` (~0.02).
   - `GridTemplate { id; label; count; cells: CellRect[] }`.
   - Re-author `CATALOG` for counts 1..6 on 12 x 12 (rows/cols/grids/1-over-N/hero as clean
     splits; hero = 8 : 4). Stable-enough ids (dev, no migration).
   - `autoCells(count)`: a balanced grid arrangement for any count (rows of up to 3).
   - `resolveCells(layoutId, count, placement?)`: placement (if length === count) else
     template cells (if template.count === count) else `autoCells(count)`.
   - Keep `layoutsForCount`, `getLayout`, `defaultLayoutId`. Remove the split-tree API.

3. **Engine** (`src/lib/layout.ts`):
   - `gridRegions(cells, contentW, contentH)`: tracks + gutter -> one `Rect` per cell (the
     region formula from the spec).
   - `computeLayout(items, contentW, contentH, cells, { density })`: regions from
     `gridRegions`, then the current contain-fit + `fillFraction` + centering (unchanged).

4. **Engine + catalog tests** (`src/lib/layout.test.ts`, `src/lib/layouts.test.ts`, rewrite).

5. **Renderers**:
   - `LayoutThumb.tsx`: render `CellRect[]` as SVG rects on a 12 x 12 viewbox (prop
     `cells` instead of `node`).
   - `Paper.tsx`, `Thumb.tsx`, `PreviewPaper.tsx`, `CoverCard.tsx`, `src/lib/print.ts`:
     replace `resolveNode(...)` with `resolveCells(...)` and pass `cells` to `computeLayout`.
     `CoverCard` uses a single full-grid cell.
   - `PageCard.tsx`: the layout picker passes `tpl.cells` to `LayoutThumb`.

6. **Store** (`src/store.ts`):
   - `syncLayout`: additionally drop `placement` when `placement.length !== count`.
   - `setPageLayout`: clear `placement` (re-selecting a template re-attaches).

## Test Plan

| Module  | Scenario                                                        | Expected                                                          |
| ------- | -------------------------------------------------------------- | ---------------------------------------------------------------- |
| layout  | mixed portrait + landscape in a multi-cell layout at density D | every placed cell `w/h === photo.ratio`                          |
| layout  | panorama in a cell                                             | scaled to fit its region, ratio intact, no clip                  |
| layout  | every region + photo box stays within the content box         | no overflow (region and box bounds)                              |
| layout  | single full-grid cell (1 photo)                               | region equals the content box (within epsilon)                  |
| layout  | two side-by-side cells                                         | exactly one gutter between their regions                        |
| layout  | regions are density-independent                               | region rects identical across densities; only photo box scales  |
| layouts | every catalog template                                        | `cells.length === count`; each cell within [0,12] x [0,12]      |
| layouts | catalog templates do not overlap                              | no two cells of a template share a grid unit                    |
| layouts | `autoCells(n)` for n = 1..9                                    | n cells, within bounds, non-overlapping                          |
| layouts | `resolveCells` precedence                                     | valid placement > matching template > autoCells                  |
| layouts | `resolveCells` unknown id / stale placement                   | falls back to `autoCells(count)`                                 |
| store   | `setPageLayout` on a custom page                              | `placement` cleared, `layoutId` set                             |
| store   | count change makes `placement` stale                          | `syncLayout` drops `placement`                                   |

Ratio + fit assertions live in `layout.test.ts` (every cell `w/h === ratio`, all boxes
within the content box). The grid is the new region source; contain-fit is unchanged.

## Verify in-app (Phase 5)

- `npm run build && npm run preview`; Load an example.
- Confirm each layout (1..6 photos, every picker option) renders as before on the grid;
  check covers, the book preview, and a full-page (spec 012) page still work; export a PDF
  and confirm pages match. Light and dark.

## Deferred (later phases, not this spec)

- **Phase B**: free-placement editor (drag to move, drag edges to resize, snapped to the
  grid), writing `page.placement`; the detach-from-template flow.
- **Phase C**: adjustable grid resolution, overlaps / z-order, spanning a photo across a
  double-page spread.
