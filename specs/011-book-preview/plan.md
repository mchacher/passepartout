# 011 - Implementation plan

## Steps (in order)

1. **Pure helper `src/lib/preview.ts`** (no React, no DOM):
   - `type Leaf` = a discriminated union:
     - `{ kind: "cover"; face: CoverFace; label: string }`
     - `{ kind: "page"; pageId: string; index: number; label: string }`
     (carry only what the renderer needs to look up in the store; keep it plain data)
   - `bookLeaves(pageIds: string[]): Leaf[]` -> `[front, insideFront, ...pages, insideBack, back]`
     in booklet order, with human labels ("Front cover", "Inside front", "Page k",
     "Inside back", "Back cover").
   - `toSpreads(leaves: Leaf[]): Leaf[][]` -> first leaf alone (cover recto), then
     `(verso, recto)` pairs; a trailing odd leaf is a single. Never drops a leaf.
   - `spreadIndexOfLeaf(spreads, predicate): number` -> which spread contains a leaf
     (for rail click -> jump).
   - `fitSpread(avail: {w:number;h:number}, aspect: number, n: 1|2, gutterFrac: number):
     { pageW: number; pageH: number }` -> largest page size (px) such that `n` pages of
     `aspect` plus `(n-1)*gutterFrac*pageW` gutter fit inside `avail`, maximizing size.
     `pageW / pageH === aspect` exactly (ratio kept).

2. **Engine/lib tests `src/lib/preview.test.ts`** (write with the logic, per Test Plan).

3. **Store**: no change (view state stays local).

4. **`src/components/PreviewPaper.tsx`** (new, read-only): props
   `{ leaf, pageW, photos, covers, pages, bookSize }` (or resolved page/cover data).
   Renders a `bg-paper` box at `pageW` px (height `pageW/aspect`), `containerType:
   inline-size`, and:
   - **page**: header (title/subtitle) + `computeLayout(items, contentW, contentH, node,
     {density})` with the SAME margins/top-offsets/text-scale formulas as `Paper`;
     per-photo captions under each photo. Blank when the page has no photos.
   - **cover**: title/subtitle top + single-slot contained photo, mirroring `CoverCard`.
   No DnD, no remove button, no contentEditable.

5. **`src/components/BookPreview.tsx`** (new): full-screen fixed overlay.
   - Reads store (`pages`, `photos`, `frontCover`, `insideFrontCover`, `insideBackCover`,
     `backCover`, `bookSize`).
   - Builds `leaves`/`spreads` via `src/lib/preview.ts`.
   - `useState` current spread index; clamps on project change.
   - Measures the stage area with a `ResizeObserver`; computes `fitSpread` for the current
     spread; renders 1-2 `PreviewPaper` side by side with a gutter, centered.
   - Right rail: `Thumb` per leaf (booklet order), click -> jump to spread; current
     spread's leaves highlighted; rail scrollable.
   - Prev/next buttons, `ArrowLeft`/`ArrowRight`, `Escape`, backdrop click; spread label +
     "i / total" counter.

6. **`src/components/TopBar.tsx`** (edit): add a "Preview" button (book/eye icon) before
   Export, disabled when `photos.length === 0`, toggling local `previewOpen`; render
   `<BookPreview open={previewOpen} onClose={...} />`.

## Test Plan

| Module  | Scenario                                                        | Expected                                                        |
| ------- | -------------------------------------------------------------- | -------------------------------------------------------------- |
| preview | `bookLeaves` with N pages                                      | order = front, insideFront, page1..N, insideBack, back         |
| preview | `bookLeaves` labels                                            | "Front cover", "Inside front", "Page 1".., "Inside back", "Back cover" |
| preview | `toSpreads` on the leaves                                      | `[[front],[insideFront,page1],[page2,page3],...]`; no leaf lost |
| preview | `toSpreads` with an even vs odd total                         | trailing odd leaf is a single spread                           |
| preview | `toSpreads` flattened                                         | equals the input leaves in order (nothing dropped/reordered)   |
| preview | `spreadIndexOfLeaf` for a known page                          | returns the spread that contains it                            |
| preview | `fitSpread` width-bound (wide short stage), n=2               | `2*pageW + gutter <= avail.w`; `pageH <= avail.h`; ratio kept  |
| preview | `fitSpread` height-bound (tall narrow stage), n=2            | `pageH === avail.h` (height binds); no width overflow          |
| preview | `fitSpread` ratio preservation, any stage                    | `pageW / pageH === aspect` (toBeCloseTo)                        |
| preview | `fitSpread` n=1 (single cover)                                | one page maximized, `pageW/pageH === aspect`, fits avail       |
| preview | `fitSpread` maximization                                      | the result touches at least one constraint (can't grow)        |

Engine ratio/fit is already covered by `layout.test.ts`; `PreviewPaper` consumes that
unchanged, so the new ratio+fit assertions live at the `fitSpread` (sizing) layer.

## Verify in-app (Phase 5)

- `npm run build && npm run preview`; Load an example, open Preview.
- Turn spreads with arrows and the rail; confirm double-page reading, space maximized,
  covers in order, and that portrait/landscape/panorama photos are never cropped or
  distorted (light and dark).
