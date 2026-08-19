# 013 Phase B - Free placement (move + resize on the grid)

## Context

Phase A put the layout catalog on a fixed 12 x 12 grid: a template is a list of `CellRect`
and a page can carry a custom `placement: CellRect[]` (resolved by the engine, but written
by nothing yet). Phase B adds the editor that writes it: the user moves and resizes a
page's photos on the grid, detaching the page from its named template.

Decisions taken (with the maintainer):

- **A per-page "Edit layout" mode** (a toggle on the page). Inside it, dragging a photo
  moves its cell and corner handles resize it, snapped to the 12 x 12 grid. Outside it, the
  page behaves exactly as today (a photo drag reorders / returns to the library). This
  avoids any gesture conflict.
- **Overlap is allowed, with an explicit stacking order** (bring to front / send to back).
  No collision blocking. Cells stay inside the grid, so nothing exceeds the trim.

## The one rule (no crop)

Free placement only ever changes a photo's **cell rectangle** (position + span). The engine
still contain-fits the photo inside that rectangle, so `w/h` always equals the ratio and
nothing is clipped: resizing a cell changes the whitespace around the photo, never its
framing. Overlap draws one contained photo over another; neither is cropped.

## Goals

- An "Edit layout" toggle per page; in that mode, move a photo (drag its body) and resize
  it (drag a corner handle), snapped to grid units, min 1 x 1, kept inside the grid.
- **Pan the photo inside its cell** (Shift-drag, hand cursor): the contain-fit photo is
  repositioned within its cell's whitespace (a per-cell anchor `ax/ay`), never cropped.
  Only the axis that has whitespace moves.
- Overlap allowed; per-photo **bring to front / send to back** sets a stacking order used
  by every renderer and the print export.
- Editing detaches the page: the first edit seeds `page.placement` from the currently
  resolved cells; further edits mutate it. Re-selecting a template clears it (Phase A).
- The grid overlay shows automatically in edit mode (a placement aid), regardless of the
  global toggle.

## Non-goals

- No free (non-grid) positioning or rotation: everything snaps to the 12 x 12 grid.
- No adjustable grid resolution, and no spanning a photo across a double-page spread
  (Phase C).
- No multi-select / group move in v1 (one cell at a time).
- No change to full-page mode (spec 012), covers, whitespace, or book sizes.

## Architecture

```
CellRect gains an optional stack order:
  CellRect { col; row; colSpan; rowSpan; z? }   // z: higher = front; templates omit it

AlbumPage.placement?: CellRect[]   // Phase A field; Phase B writes it

Edit mode (ephemeral, local to PageCard): a boolean, passed to Paper.
  Paper (edit mode):
    - draws each cell with a frame + 4 corner resize handles + a small z-order control
    - pointer-drag on the body  -> move   (snap col/row, clamp in grid)   [live local state]
    - pointer-drag on a corner  -> resize (snap span + origin, min 1x1, clamp)  [live]
    - commit on pointerup -> store.setPagePlacement(pageId, nextCells)
    - "to front" / "to back" -> restack z, commit
  Draw order (Paper / Thumb / PreviewPaper / print): cells sorted by (z ?? index),
    stable, so overlap layers correctly; the cell<->photo mapping stays by original index.

store:
  setPagePlacement(pageId, cells): sets page.placement (detaches). The editor seeds from
    resolveCells(page) when placement is undefined, so the first edit is non-destructive.
  syncLayout: reconcile placement with the photo count on add/remove (see below) instead
    of dropping it wholesale, so a small count change keeps the custom layout.
```

Files:

- `src/types.ts` (edit): `CellRect.z?`.
- `src/lib/layout.ts` (edit): a pure `drawOrder(cells)` helper (indices sorted by `z ??
  index`, stable) so every renderer and the painter layer overlap identically. `gridRegions`
  / `computeLayout` are otherwise unchanged (z does not affect geometry).
- `src/lib/grid-edit.ts` (new, PURE): snapping + clamping helpers - `pxToCell(pointer,
  box)`, `moveCell(rect, dCol, dRow)`, `resizeCell(rect, corner, dCol, dRow)`, all clamped
  to `[0, 12]`, min 1 x 1. Plus `restack(cells, index, "front" | "back")`.
- `src/lib/grid-edit.test.ts` (new).
- `src/store.ts` (edit): `setPagePlacement`; `syncLayout` reconciles placement on count
  change (drop the removed photo's cell; append an auto cell for a new photo) rather than
  dropping the whole array.
- `src/store.test.ts` (edit).
- `src/components/Paper.tsx` (edit): edit-mode rendering + move/resize/z pointer handling;
  draw cells in `drawOrder`. `pdf-export`/`print`/`Thumb`/`PreviewPaper` also honour
  `drawOrder`.
- `src/components/PageCard.tsx` (edit): the "Edit layout" toggle (local state), passed to
  `Paper`.
- `src/lib/print.ts` / `pdf-export.ts` (edit): draw photos in `drawOrder`.

## Requirements

1. `CellRect.z?` optional stack order; templates omit it; the engine ignores it.
2. A per-page "Edit layout" toggle. Only in that mode does the page expose move/resize/
   restack; outside it the page is unchanged (reorder / library DnD intact).
3. Move: drag a photo's body; its cell's `col/row` snap to grid units, clamped so the cell
   stays inside the 12 x 12 grid. Resize: drag a corner; `colSpan/rowSpan` (and origin for
   top/left corners) snap, min 1 x 1, clamped. Live feedback during the drag; committed on
   release.
4. Overlap is allowed. Each cell can be sent to front/back; `drawOrder` sorts by `z`, and
   Paper, Thumb, PreviewPaper and the export PDF all layer accordingly.
5. The first edit detaches the page (seeds `placement` from the resolved cells); the photo
   stays contain-fit throughout. Re-selecting a template clears `placement`.
6. Removing or adding a photo on a custom page reconciles `placement` (keeps the other
   cells) instead of discarding the custom layout.
7. The grid overlay is shown while a page is in edit mode.

## Acceptance criteria

- [x] An "Edit layout" toggle appears per page; entering it shows handles and the grid,
      leaving it restores normal behaviour.
- [x] A photo can be moved to another grid position (snapped, in-bounds) and resized by a
      corner (snapped, min 1 x 1, in-bounds); the photo is never cropped or distorted.
- [x] Overlapping cells layer by the stacking order; bring-to-front / send-to-back works
      and is reflected in thumbnails, the book preview and the export PDF.
- [x] The first edit detaches the page to a custom `placement`; the template picker resets
      it; removing/adding one photo keeps the rest of the custom layout.
- [x] Move/resize/restack persist (reload restores them).
- [x] `npm run validate` passes; the pure snapping/clamping and `drawOrder` are unit-tested.

## Edge cases

- **1 photo**: can be moved and shrunk (leaving whitespace); overlap is moot.
- **Resize past an edge**: clamped so the cell stays within the grid; never below 1 x 1.
- **Overlap fully covering a photo**: allowed; the lower photo is hidden but not cropped
  (send-to-front reveals it).
- **Count change on a custom page**: reconciled (remove drops that cell; add appends an
  auto cell), placement preserved for the rest.
- **Leaving edit mode mid-nothing**: no-op; a page with no edits keeps its named template.
- **Full-page (spec 012)**: the "Edit layout" toggle is hidden (full-page owns the page).
