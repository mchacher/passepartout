# Plan 035: Manual photo placement

## Implementation steps (in order)

1. **Types** (`src/types.ts`)
   - No new field. Update the `AlbumPage.photoIds` / `layoutId` comments to state the new
     invariant: a page's slot count is its layout capacity and `photoIds.length <= slotCount`
     (photos fill the first slots; the rest are empty).

2. **Lib** (`src/lib/layouts.ts`)
   - Add `slotCount(layoutId: string, photoCount: number, placement?: CellRect[]): number`
     returning `getLayout(layoutId)?.count ?? placement?.length ?? photoCount`.
   - `resolveCells` is unchanged (callers now pass the slot count instead of the photo count).
   - Delete `src/lib/demo.ts`.

3. **Lib tests** (`src/lib/layouts.test.ts`, `src/lib/layout.test.ts`)
   - `slotCount`: template id -> its leaf count; `>6` auto (no template) -> photoCount;
     custom placement -> placement length.
   - Engine fit with spare slots: `computeLayout(1 item, 3 cells)` places exactly 1 cell,
     `w/h === ratio`, and the box fits inside its region (no overflow). (Ratio + fit
     assertions required by Gate 4.)

4. **Store** (`src/store.ts`)
   - Remove `distribute()` and `loadDemo` (interface + impl) and the `makeDemoPhotos` import.
   - `importFiles`: drop the `distribute` seeding; `pages = s.pages.length === 0 ? [newPage()] : s.pages`.
   - `setPageCount(pageId, n)`: `layoutId = defaultLayoutId(n)`, clear `placement`, pop
     photos while `photoIds.length > n`, clear `fullPage` when `n !== 1`. No pull.
   - `placeOnPage`: append (skip if already present); if `slotCount < photoIds.length` after
     append, `layoutId = defaultLayoutId(photoIds.length)` and clear `placement`. Drop the
     old "add a default placement cell" logic (a free slot already exists).
   - `removeFromPage`: remove from `photoIds`; do NOT splice `placement` or shrink the
     layout (capacity unchanged). Keep `syncLayout`.
   - `syncLayout(page)`: slot-based. Compute `slots = slotCount(...)`; if `slots < photos`,
     grow (`layoutId = defaultLayoutId(photos)`, clear placement); clear `fullPage` unless
     `slots === 1`; clear `placement` when its length !== slots.

5. **Components**
   - `src/components/PageCard.tsx`: replace `const count = page.photoIds.length` with
     `const slots = slotCount(...)`; drive the count buttons (`aria-pressed = slots === n`),
     `layoutsForCount(slots)`, the full-page toggle (`slots === 1`), and `canArrange`
     (add `photoIds.length === slots`, i.e. page full) off `slots`.
   - `src/components/Paper.tsx`:
     - `const slots = slotCount(layoutId, items.length, page.placement)`.
     - `gridCells = resolveCells(layoutId, slots, page.placement)` (seed editCells likewise).
     - Render loop over `order` (slots cells): filled cell (`idx < items.length`) as today;
       empty cell -> a dashed placeholder box sized to its region (drop target).
     - Replace the single `items.length === 0` message with per-slot placeholders.
     - `canEdit = editing && !fullPage && items.length > 0 && items.length === slots`.
   - `src/App.tsx`: remove the "Load an example" button and the `loadDemo` binding.
   - `src/lib/i18n.ts`: remove `app.empty.demo` (EN + FR).

6. **Docs**: fold the slot-count model into `docs/architecture.md` (one or two lines);
   update `docs/overview.md` / README feature list (import is library-first; no demo).

## Test Plan

| Module   | Scenario                                                    | Expected                                                        |
| -------- | ----------------------------------------------------------- | -------------------------------------------------------------- |
| layouts  | `slotCount("three-row", 1)`                                 | 3 (template leaf count, not photo count)                       |
| layouts  | `slotCount("auto", 9)` (no template)                        | 9 (falls back to photoCount)                                   |
| layouts  | `slotCount(id, k, placement of length 4)`                   | 4 (placement wins for a detached page)                         |
| layout   | `computeLayout([1 item], w, h, 3 cells, density)`           | 1 placed cell; `w/h === item.ratio`; box within region (fit)   |
| layout   | panorama in a spare-slot page                               | scaled to fit, ratio intact, no clip                           |
| store    | `importFiles(files)` on a fresh project                     | photos in library; every page has 0 photos; exactly one page   |
| store    | `importFiles` when pages already exist                      | photos added to library; pages unchanged                       |
| store    | `setPageCount(p, 3)` on an empty page                       | `slotCount === 3`; `photoIds` still empty (no pull)            |
| store    | `setPageCount(p, 2)` on a page holding 4                    | keeps first 2; other 2 no longer on any page (in library)     |
| store    | `placeOnPage` into a page with a free slot                  | photo appended; `slotCount` unchanged                          |
| store    | `placeOnPage` onto a full 3-slot page                       | `slotCount === 4`; photo placed                                |
| store    | `placeOnPage` a photo already on the page                   | no-op (no duplicate)                                           |
| store    | `removeFromPage` one of 3                                   | 2 photos; `slotCount` still 3 (a slot is now empty)           |
| store    | `loadDemo` / `makeDemoPhotos`                                | no longer exported (removed)                                   |

## Verify in-app (Phase 5)

Build + preview. Import a few photos (or drag files): confirm they land in the library only
and one empty page appears. Click "3" on the page: three empty slots show, no photos added.
Drag two photos in: they fill the first two slots, the third stays an empty placeholder.
Confirm no photo is cropped or distorted (portrait stays portrait, panorama stays panorama).
Confirm the "Load an example" button is gone. Check a light and a dark render.
