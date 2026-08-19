# 013 Phase B - Implementation plan

## Steps (in order)

1. **Types** (`src/types.ts`): `CellRect.z?: number` (optional stack order; higher = front;
   templates omit it; the engine ignores it).

2. **Pure helpers** (`src/lib/grid-edit.ts`, new):
   - `pxToUnit(px, boxPx)` -> a grid unit (round, clamp to [0, 12]).
   - `moveCell(rect, dCol, dRow)` -> new rect translated and clamped so it stays in-grid.
   - `resizeCell(rect, corner, dCol, dRow)` -> new rect with the dragged corner moved,
     span >= 1, kept in-grid (top/left corners move the origin).
   - `restack(cells, index, "front" | "back")` -> cells with that index's `z` set past the
     current max / below the current min.
   Plus in `src/lib/layout.ts`: `drawOrder(cells): number[]` (indices sorted by `z ??
   index`, stable) so overlap layers identically everywhere.

3. **Pure tests** (`src/lib/grid-edit.test.ts`, and `drawOrder` in `layout.test.ts`).

4. **Store** (`src/store.ts`):
   - `setPagePlacement(pageId, cells)` -> sets `page.placement`.
   - `syncLayout`: on a count change to a page that has a `placement`, reconcile it (slice
     out a removed photo's cell; append an `autoCells`-style cell for a new photo) instead
     of dropping the whole array. Keep dropping it only when it cannot be reconciled.

5. **Store tests** (`src/store.test.ts`): set placement; reconcile on add/remove.

6. **Renderers honour `drawOrder`**: `Paper`, `Thumb`, `PreviewPaper`, `print.ts` /
   `pdf-export.ts` iterate cells/photos in `drawOrder` so overlap layers the same on
   screen, in thumbnails, in the preview and in the PDF.

7. **Editor** (`src/components/Paper.tsx`): an `editing` prop.
   - In edit mode, render each cell with a frame, 4 corner handles, and a small
     front/back control; show the grid overlay.
   - Pointer-drag on the body -> `moveCell` (live local state, snap, clamp); on a corner ->
     `resizeCell`; commit the whole placement on pointerup via `setPagePlacement`.
   - Seed `placement` from `resolveCells(page)` on the first edit (detach).
   - The photo stays contain-fit (reuse the engine); no crop.

8. **PageCard** (`src/components/PageCard.tsx`): an "Edit layout" toggle (local `editing`
   state), hidden in full-page mode, passed to `Paper`.

## Test Plan

| Module    | Scenario                                              | Expected                                                     |
| --------- | ----------------------------------------------------- | ------------------------------------------------------------ |
| grid-edit | `moveCell` within bounds                              | rect translated by (dCol,dRow), same spans                   |
| grid-edit | `moveCell` past an edge                               | clamped so col/row keep the cell inside [0,12]               |
| grid-edit | `resizeCell` a bottom-right corner larger             | colSpan/rowSpan grow, origin unchanged, clamped in-grid      |
| grid-edit | `resizeCell` a top-left corner                        | origin moves, span adjusts, span never below 1               |
| grid-edit | `resizeCell` below the minimum                        | span clamped to 1 x 1                                        |
| grid-edit | `restack(front)` / `restack(back)`                    | that cell's z is above max / below min of the others         |
| layout    | `drawOrder` with explicit z                           | indices sorted by z, stable for ties (falls back to index)   |
| layout    | `drawOrder` without z                                 | identity order (0..n-1)                                       |
| store     | `setPagePlacement` sets the page's placement          | placement stored; other pages untouched                      |
| store     | remove a photo from a custom page                     | placement keeps the other cells (reconciled, not dropped)    |
| store     | add a photo to a custom page                          | placement gains a cell, others unchanged                     |

The engine's ratio + fit assertions (Phase A) still hold: free placement only changes the
cell rectangles, and `computeLayout` contain-fits inside them, so `w/h === ratio` and no
overflow beyond the cell.

## Verify in-app (Phase 5)

- `npm run build && npm run preview`; Load an example.
- Enter "Edit layout" on a multi-photo page: move a photo, resize it by a corner, overlap
  two, bring one to front / send to back. Confirm snapping to the grid, no crop/distortion,
  and that thumbnails + book preview + a PDF export match the stacking. Leave and re-enter;
  reload to confirm persistence. Light and dark.

## Deferred (Phase C)

- Adjustable grid resolution, multi-select/group move, spanning a photo across a
  double-page spread.
