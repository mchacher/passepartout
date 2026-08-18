# 007 - Page reorder - Implementation plan

Order: store action + tests -> dnd payload -> Thumb -> PageRail -> App wiring.
No engine or types change.

## Steps

1. **Store** - `src/store.ts`: add `movePage(pageId, toIndex)` to `AlbumState` and the
   implementation: find the page's current index, splice it out, clamp `toIndex` to
   `[0, pages.length - 1]`, splice it back in, `scheduleSave()`. A no-op when the index
   is unchanged or the id is unknown.

2. **Store tests** - `src/store.test.ts`: movePage moves within bounds, clamps out-of-
   range, no-ops on unknown id / same index, leaves photos and covers untouched.

3. **DnD payload** - `src/components/dnd.ts`: add
   `export const PAGE_DND_TYPE = "application/x-passepartout-page";` (distinct from the
   photo `text/plain`, so photo and page drags never cross-fire).

4. **Thumb** - `src/components/Thumb.tsx` (new, pure-ish presentational): props
   `{ items: {ratio}[]; layoutId; whitespace; format; label?; empty? }`. Computes
   `computeLayout` at the nominal box and renders regions + photos positioned in percent
   (contain-fit, no crop). An empty-paper placeholder when `items` is empty. The photo
   images come from a passed url map or the photo objects; covers pass their single
   photo. Uses `bg-paper` so it follows the album palette.

5. **PageRail** - `src/components/PageRail.tsx` (new): reads `photos`, `pages`, `format`,
   `frontCover`, `insideFrontCover`, `insideBackCover`, `backCover`, `movePage`. Renders
   locked cover thumbs, then draggable page thumbs (numbered) with drop handling:
   - Each page thumb is `draggable`, sets `PAGE_DND_TYPE = page.id` on dragstart.
   - `onDragOver` computes whether the pointer is in the top or bottom half to choose an
     insert-before / insert-after index and shows an insertion line.
   - `onDrop` calls `movePage(draggedId, targetIndex)`.
   - A trailing drop zone after the last page for "move to end".
   - Clicking a thumb scrolls its anchor into view.
   - Covers are rendered with the same `Thumb` but not draggable and not drop targets.

6. **App wiring** - `src/App.tsx`: add the rail as a third grid column
   (`grid-cols-[274px_1fr_190px]`, collapsing/hiding the rail under the existing
   `max-[760px]` breakpoint). Give each cover and page an anchor id (`cover-front`,
   `cover-insideFront`, `page-<id>`, `cover-insideBack`, `cover-back`) on its wrapper so
   the rail can `scrollIntoView`.

7. **Docs**: `docs/architecture.md` (module map + a line on reorder / thumbnail engine
   reuse + extension point), `docs/overview.md`, `README.md` feature list, and tick the
   `CLAUDE.md` roadmap item.

## Test Plan

| Module | Scenario                                                    | Expected                                            |
| ------ | ---------------------------------------------------------- | --------------------------------------------------- |
| store  | `movePage` from index 0 to 2                                | pages reordered, others shift, ids intact           |
| store  | `movePage` to an out-of-range index                        | clamped into `[0, len-1]`, no throw                 |
| store  | `movePage` to the same index                               | order unchanged (no-op)                             |
| store  | `movePage` with an unknown id                              | order unchanged (no-op)                             |
| store  | `movePage` does not touch photos or covers                 | `photos` and cover state identical                  |
| store  | reordering keeps each page's photoIds / layoutId           | pages intact apart from position                    |
| layout | (regression) engine untouched                              | existing ratio + fit tests stay green               |

Note: `Thumb` / `PageRail` are presentational (no unit tests, per repo convention);
they are verified in Phase 5 by driving the app.

## Verify in app (Phase 5)

- `npm run build && npm run preview`, Load an example.
- Confirm the rail shows faithful thumbnails (portrait/panorama contained, not cropped).
- Drag a page thumbnail to a new position: the main editor and Library page numbers
  update; covers stay put and cannot be dragged. Click a thumbnail: the editor scrolls
  to it. Reload: the new order persists.
