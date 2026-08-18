# 007 - Page reorder + page navigator rail

## Context

An album's page order is fixed at import: pages appear in the order photos were
distributed, and there is no way to rearrange them. A photographer organizing a story
needs to move pages around. This adds a **page navigator rail** on the right showing a
thumbnail of every page, and **drag and drop to reorder the content pages**. The four
cover faces (front, inside front, inside back, back) are fixed and never move.

## Goals

- A right-hand **rail** listing, top to bottom in booklet order: front cover, inside
  front cover, each content page (numbered), inside back cover, back cover. Each entry
  is a faithful **thumbnail** of that page/cover.
- **Reorder content pages by dragging** their thumbnails within the rail. An insertion
  indicator shows where the page will land. Covers are shown but locked: they cannot be
  dragged, and a page cannot be dropped before the front covers or after the back
  covers.
- **Click a thumbnail** to scroll the main editor to that page or cover.
- Order persists (it is inherent in the `pages` array, already serialized) and is
  carried by duplication.

## Non-goals

- No reordering of the cover faces (they are structural).
- No reordering of photos within a page (separate roadmap item).
- No change to the layout engine, whitespace, or photo geometry.
- No new persisted field: page order is just the order of the existing `pages` array.

## The one rule

Untouched, and reinforced. Reordering only permutes the `pages` array; it never
touches a photo's `ratio`, size, or placement. The **thumbnails reuse the pure
`computeLayout`** at a nominal size, so every photo in a thumbnail is contain-fit and
never cropped, exactly like the real page. `src/lib/layout.ts` is not modified.

## Requirements

### Data model

- No type changes. Page order = index in the store's `pages: AlbumPage[]` (content
  pages only; the four covers are separate `Cover` state and are structurally fixed by
  `App`). Photos reference `pageId`, not an index, so reordering never disturbs photos
  or layouts.
- New store action `movePage(pageId: string, toIndex: number)`: removes the page and
  reinserts it at `toIndex` (clamped to the content-page range), then `scheduleSave()`.
  Nothing else changes (no `syncLayout` needed; order does not affect counts).

### Engine reuse (thumbnails)

- A thumbnail is rendered from `computeLayout(items, NW, NH, resolveNode(layoutId,
  count), { density: whitespaceToDensity(whitespace) })` at a nominal box
  (`NH = 100`, `NW = 100 * PAGE_ASPECT[format]`), positioning each region and photo in
  **percent** of the nominal box so it scales to any thumbnail pixel width with no DOM
  measuring. Photos are contain-fit (`object` never stretched), covers use the
  single-slot `autoTemplate(1)`. This is the documented "reuse the engine at a
  different surface" pattern; it guarantees the thumbnail honors the no-crop rule.

### UI

- New `PageRail` component: a third column in `App`'s grid (right side, fixed width,
  hidden on narrow screens). It renders `Thumb` entries in booklet order:
  - Front cover, inside front cover: locked (not draggable, not a drop slot between the
    covers and the first page in a way that would move a page outside the content band).
  - Each content page: draggable, numbered, a drop target that inserts the dragged page
    at its position; an insertion line marks the target; plus a trailing drop zone after
    the last page.
  - Inside back cover, back cover: locked.
- New `Thumb` component: the faithful mini-render described above, with a small number
  or label badge and an empty-paper placeholder when a page/cover has no photos.
- A new drag payload type `PAGE_DND_TYPE` in `dnd.ts` (distinct from the photo type) so
  page drags and photo drags never collide.
- Clicking a thumbnail scrolls the matching page/cover into view. `App` gives each
  rendered page and cover a stable DOM anchor id (`page-<id>`, `cover-<face>`) for
  `scrollIntoView`.

## Acceptance criteria

- [x] The rail shows a faithful thumbnail of every cover and content page, in booklet
      order, updating live as pages/photos/layout/whitespace change.
- [x] Dragging a content-page thumbnail reorders the pages; the main editor and the
      Library page numbers reflect the new order immediately.
- [x] The four cover faces cannot be dragged, and no drag can place a page before the
      front covers or after the back covers.
- [x] Clicking a thumbnail scrolls the main editor to that page or cover.
- [x] No photo is cropped, distorted, or resized in a thumbnail or on the page; a
      portrait stays portrait and a panorama stays a panorama.
- [x] The new order persists across a reload and is carried by duplication.
- [x] `computeLayout` / `src/lib/layout.ts` unchanged; ratio/fit tests stay green.

## Edge cases

- **0 content pages**: the rail shows only the covers; nothing to reorder.
- **1 content page**: draggable but has nowhere to move (drop is a no-op).
- **Empty page** (no photos): thumbnail shows the empty-paper placeholder.
- **Panorama / portrait** in a thumbnail: contain-fit, never clipped.
- **Drop on the same position** or outside the content band: no-op (order unchanged).
- **Narrow screens**: the rail is hidden (the editor already collapses to one column).
