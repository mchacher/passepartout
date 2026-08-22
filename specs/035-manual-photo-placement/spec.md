# Spec 035: Manual photo placement (import never fills the album; slots are filled by dragging)

## Context

Today the app places photos into album pages automatically:

- The **first import** calls `distribute()`, which creates pages and drops photos onto
  them (3 per page). Later imports go to the library only.
- The **count buttons** on a page (`setPageCount`) auto-fill: growing the count pulls
  unused photos out of the library into the page.

The user wants deliberate composition instead. The **library is the catalog**; a photo
lands on a page **only** when the user drags it there. Importing photos should never
scatter them across pages, and clicking a number on a page should never grab photos from
the library.

This means a page needs a notion of **slot count** (how many photos the page is laid out
for) that is separate from **how many photos are actually placed**. Clicking "3" gives a
page three slots; the empty slots are drop targets the user fills by dragging.

The "Load an example" demo is also removed (the user does not want a pre-filled example in
any case).

## The one rule (unchanged)

Nothing here crops, clips, or non-proportionally resizes a photo. Empty slots are just
placeholders; the layout engine is untouched. The ratio invariant holds by construction.

## Goals

1. **Import to the library only.** `importFiles` adds photos to the library and never
   places them on a page. If the album has no pages yet, it creates one empty page so the
   user has somewhere to drag.
2. **Slot count decoupled from placed photos.** A page's slot count is its layout
   capacity; `photoIds` fills the first slots in order; the rest render as empty
   placeholders. Invariant: `photoIds.length <= slotCount`.
3. **Count buttons set capacity, never pull photos.** Clicking N sets the page to the
   default N-slot layout and shows N slots. Shrinking below the placed count returns the
   overflow photos to the library. No photo is ever auto-added.
4. **Photos enter a page only by dragging.** A drop fills the next empty slot (in order).
   Dropping onto a full page grows the layout by one so the photo has a cell.
5. **Remove the "Load an example" demo** entirely (button, store action, generator, and
   its i18n strings).

## Non-goals

- No change to crop / framing / masks / the layout engine geometry.
- **No per-slot precise drop targeting.** A drop fills the next empty slot in order; it
  does not target a specific empty cell. (Rearranging is done afterwards in Edit layout.)
- **"Edit layout" (free placement) stays available only when the page is full**
  (`photoIds.length === slotCount`). Editing the geometry of empty cells is out of scope;
  fill the slots first, then rearrange. This keeps the existing editor unchanged.

## Data model

**No new field.** The slot count is derived from what a page already stores:

```
slotCount(page) = getLayout(page.layoutId)?.count   // a named template's leaf count (1..6)
               ?? page.placement?.length            // a custom placement is one rect per slot
               ?? page.photoIds.length              // "auto" (>6 dragged): full, no empty slots
```

Invariant maintained by the store: `photoIds.length <= slotCount(page)`.

Back-compatible: existing pages were saved with `layoutId` matching their photo count, so
`slotCount === photoIds.length` and they render exactly as before. (A page whose photo was
deleted elsewhere now shows an empty slot instead of re-flowing, which is acceptable and
arguably better.)

## Architecture (flow + files)

```
Import  -> importFiles: add to library; if no pages, add ONE empty page. Never distribute().
Click N -> setPageCount: layoutId = defaultLayoutId(N); drop overflow photos to library. No pull.
Drag    -> placeOnPage: append to photoIds (fills next empty slot); if page was full, grow layout.
Remove  -> removeFromPage: drop the photo; slot count unchanged -> a trailing slot goes empty.
Render  -> Paper: cells = resolveCells(layoutId, slotCount, placement); computeLayout fills the
           first k; regions k..slotCount-1 render as empty placeholder drop targets.
```

Files changed:

- `src/lib/layouts.ts` — add `slotCount(layoutId, photoCount, placement)` helper.
- `src/store.ts` — `importFiles`, `setPageCount`, `placeOnPage`, `removeFromPage`,
  `syncLayout` (slot-based); remove `distribute`, `loadDemo`, the `makeDemoPhotos` import.
- `src/components/Paper.tsx` — render `slotCount` cells; empty cells become placeholder
  drop targets; gate `canEdit` on a full page.
- `src/components/PageCard.tsx` — count buttons / layout picker / full-page / arrange gate
  key on `slotCount`, not `photoIds.length`.
- `src/App.tsx` — remove the "Load an example" button.
- `src/lib/i18n.ts` — remove `app.empty.demo` (EN + FR).
- `src/lib/demo.ts` — delete (only consumer was `loadDemo`).
- `src/lib/layout.ts` — unchanged (already places `min(items, cells)`).

## Requirements

- R1: After `importFiles`, no photo is on any page; the album has at least one page.
- R2: `setPageCount(pageId, n)` sets the page to the default n-slot layout and never adds a
  photo; if `photoIds.length > n`, the trailing photos are removed (back to library).
- R3: A page renders `slotCount` cells: the first `photoIds.length` hold photos, the rest
  are empty placeholder drop targets.
- R4: Dropping a library photo onto a page fills the next empty slot; if the page is full,
  the layout grows by one to hold it.
- R5: Removing a photo from a page leaves its capacity unchanged (a trailing slot empties).
- R6: The "Load an example" button, `loadDemo`, `makeDemoPhotos`/`demo.ts`, and the
  `app.empty.demo` strings no longer exist.
- R7: The layout engine is unchanged; every placed photo keeps `w/h === ratio` and fits
  its region (no overflow), including when there are more slots than photos.

## Acceptance criteria

- [x] Importing photos leaves every page empty and creates one empty page when none exist.
- [x] Clicking a number on a page shows that many slots and adds no photos.
- [x] Empty slots are visible placeholders and accept a dragged photo.
- [x] Shrinking the count returns overflow photos to the library (still in the library).
- [x] Dropping onto a full page grows it by one slot.
- [x] The "Load an example" button is gone; the empty state shows only Import.
- [x] `npm run validate` is green, including the ratio + fit assertions.
- [x] Verified in the real app: import then compose a page by dragging; no crop/distortion.

## Edge cases

- Empty page: 1 slot, one placeholder ("Drag a photo here").
- Click 6, drag 2: 2 filled + 4 empty placeholders.
- Shrink 6 -> 2 with 4 placed: keep the first 2, the other 2 return to the library.
- Drag onto a full 3-slot page: grows to a 4-slot layout with the new photo placed.
- Remove the middle of 3: photos compact, the last slot becomes empty (capacity stays 3).
- More than 6 dragged onto one page: falls back to the auto layout (full, no empty slots).
- Existing projects: render identically; a photo deleted earlier now leaves an empty slot.
