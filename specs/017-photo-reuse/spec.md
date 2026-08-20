# Spec 017 — Reuse a photo across pages

## Context

Today a photo belongs to at most one page: `Photo.pageId` is a single back-reference,
and dragging a photo from the Library to a page MOVES it (removing it from its previous
page). A photographer often wants the same photo on more than one page (a recurring
motif, a chapter opener repeated, the same portrait echoed later). The Library should
also make it obvious which photos are still unused, and how many times each is used.

## Goals

- A photo can appear on any number of pages (and cover faces) at once. It is never
  "consumed" by a page; the Library is a permanent catalog of every imported photo.
- Dragging a photo from the Library onto a page ADDS it there and keeps it wherever it
  already sits (reuse by default). Removing a photo from a page is an explicit action on
  that page.
- The Library badges each photo with how many times it is used across the album (pages
  plus the four cover faces), and offers a filter to show only the unused photos.

## Non-goals

- No change to the layout engine or the never-crop rule: a page still lays out its own
  `photoIds` exactly as before.
- No per-placement caption or crop: a reused photo is the same `Photo`, so its caption
  and crop are shared across every place it appears (a later spec could split them).
- No same-photo-twice on a single page (placement dedupes within a page).

## The one rule

Reuse changes only WHICH pages list a photo id; each page still runs the unchanged pure
`computeLayout` over its own photos, contain-fit. Nothing crops, clips, or distorts. The
invariant is untouched by construction (no engine change).

## Data model

- **Remove `Photo.pageId`.** Placement is derived solely from where a photo id appears:
  the pages' `photoIds` and the four cover `photoId`s. `pageId` is dropped from the type;
  old project docs that still carry it load fine (the field survives only as an inert,
  untyped runtime prop that nothing reads), so no migration is needed.
- New pure helper `src/lib/usage.ts`: `countUsage(pages, coverPhotoIds)` returns a
  `Map<photoId, number>` of total appearances across every page's `photoIds` and each
  non-null cover photo id. `isUnused(map, id)` / a small `usageCount` accessor as needed.

## Store

- `placeOnPage(photoId, pageId)`: ADD the photo to the target page's `photoIds` if not
  already there (dedupe); append a default placement cell when the page has a custom
  placement; re-sync the layout. It no longer removes the photo from any other page.
- `removeFromPage(photoId, pageId)`: remove the photo from THAT page only (and its
  placement cell, aligned by index); re-sync. **Signature gains `pageId`** (callers know
  their page).
- `unplaceFromAllPages(photoId)`: remove the photo from every page (used when a photo is
  dragged back onto the Library). Covers are not touched (managed by their own control).
- `setPageCount(pageId, n)`: shrink pops the trailing photos from this page; grow pulls
  UNUSED photos (usage 0, in capture-time order) that are not already on the page, and
  stops when there are none left (a page can only auto-grow as far as unused photos
  allow). No more borrowing from later pages.
- `distribute`, `loadPhoto`, `demo.ts`: drop the `pageId` assignment.
- `deletePage`: just removes the page; its photos stay in the Library (usage recomputed).

## UI

- **Library** (`src/components/Library.tsx`): compute the usage map from `pages` + the
  four covers. Each thumbnail is dimmed when used (usage > 0) and carries a small count
  badge showing the number (replacing the old single "page N" label). The header shows
  the unused count (`N unused / total`). A "Unused only" toggle filters the grid to
  photos with usage 0 (local, transient view state). Dropping a photo onto the Library
  calls `unplaceFromAllPages`.
- **Callers of `removeFromPage`** gain the page id: `Paper.tsx` (cell remove, full-page
  remove) and `PageCard.tsx` (Edit-layout toolbar) pass their `page.id`.

## Acceptance criteria

- [x] Dragging a Library photo onto a page adds it there and leaves it on any other page
      it was already on.
- [x] The same photo renders correctly on two different pages at once (contain-fit, no
      crop, independent per-page layout).
- [x] Each used Library thumbnail shows a numeric badge of its usage count; unused ones
      show no badge and are not dimmed.
- [x] A photo used only on a cover counts as used (badge, not shown by the unused filter).
- [x] The "Unused only" filter shows exactly the photos with usage 0.
- [x] Removing a photo from one page leaves it on the others and updates the badge.
- [x] Dragging a photo back onto the Library removes it from every page.
- [x] Deleting a page keeps its photos in the Library with the usage recomputed.

## Edge cases

- No photos / empty page: usage map empty; the filter shows nothing; no badges.
- Grow past the unused pool: the page grows only as far as unused photos allow, then
  stops (the count buttons cannot force duplicates).
- Duplicate project: the photo id remap is one-old-id -> one-new-id, so a reused photo
  stays reused across all its pages and covers in the copy.
- A reused photo's caption / crop is shared (same `Photo`); editing it on one page changes
  it everywhere it appears (documented, intentional for this spec).
