# Plan 017 — Reuse a photo across pages

## Implementation steps

1. **Types** — `src/types.ts`: remove `pageId` from `Photo` (update the doc comment: a
   photo's placement is derived from the pages / covers that list it).
2. **Pure lib** — `src/lib/usage.ts`:
   - `countUsage(pages: AlbumPage[], coverPhotoIds: (string | null)[]): Map<string, number>`
     — tally each page's `photoIds` and each non-null cover id.
   - `usageCount(map, id): number` and `isUnused(map, id): boolean` convenience accessors.
3. **Lib tests** — `src/lib/usage.test.ts` per the Test Plan.
4. **Store** — `src/store.ts`:
   - `distribute`, `loadPhoto`, and `src/lib/demo.ts`: drop `pageId`.
   - `placeOnPage`: add-if-absent (reuse), no removal from other pages; append a default
     cell for a custom placement; `syncLayout`.
   - `removeFromPage(photoId, pageId)`: remove from that page only; align placement.
   - `unplaceFromAllPages(photoId)`: remove from every page.
   - `setPageCount`: shrink pops trailing; grow pulls unused-only (usage 0), no borrowing.
   - `deletePage`: drop the page; no `pageId` reset.
   - Update the `AlbumState` interface (new/changed signatures).
5. **Store tests** — extend `src/store.test.ts`: update the affected tests (remove the
   "borrows from later pages" test, adapt `removeFromPage` calls to pass a page id, adjust
   the `placeOnPage` move-vs-add expectations) and add the reuse cases.
6. **Components**:
   - `Library.tsx`: usage map from `pages` + covers; dim + numeric badge on used thumbs;
     `N unused / total` header; "Unused only" toggle (local state); drop -> `unplaceFromAllPages`.
   - `Paper.tsx`: `removeFromPage(id)` -> `removeFromPage(id, page.id)` (two call sites).
   - `PageCard.tsx`: toolbar `removeFromPage(sel.photoId)` -> `removeFromPage(sel.photoId, page.id)`.

## Test Plan

| Module | Scenario                                                        | Expected                                            |
| ------ | --------------------------------------------------------------- | --------------------------------------------------- |
| usage  | a photo on two pages                                            | count 2                                             |
| usage  | a photo on a page and a cover                                   | count 2 (covers included)                           |
| usage  | a photo nowhere                                                 | count 0 / `isUnused` true                           |
| usage  | null cover ids are ignored                                      | no phantom counts                                   |
| store  | `placeOnPage` adds to target, keeps photo on its other page     | photo id in both pages' `photoIds`                  |
| store  | `placeOnPage` onto a page already holding it is a no-op         | no duplicate id, placement preserved                |
| store  | `removeFromPage(id, pageA)` with the photo also on pageB        | gone from A, still on B                             |
| store  | `unplaceFromAllPages(id)`                                       | absent from every page                              |
| store  | `setPageCount` grow pulls an unused photo, never a used one     | a used photo is not duplicated onto the page        |
| store  | `setPageCount` grow with no unused photos left                  | the page count stays (no borrow, no duplicate)      |
| store  | `deletePage` keeps its photos and lowers their usage            | photos still present; usage recomputed              |

No engine change, so no new ratio/fit assertions; the invariant holds by construction
(a page still lays out its own photos unchanged). The in-app pass (Phase 5) confirms the
same photo renders contain-fit on two pages at once.

## Tasks

- [x] 1 Types: remove `Photo.pageId`
- [x] 2 Pure `usage.ts`
- [x] 3 `usage.test.ts`
- [x] 4 Store: reuse actions + setPageCount + deletePage + distribute
- [x] 5 Store tests updated + reuse cases
- [x] 6 Library badge/filter + removeFromPage callers
- [x] 7 Validate + verify in-app + docs
