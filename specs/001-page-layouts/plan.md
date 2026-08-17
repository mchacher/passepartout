# 001 - Page layouts - Implementation plan

Implement strictly in this order (types -> pure lib -> lib tests -> store -> UI).

## Steps

1. **Types** (`src/types.ts`)
   - Add `layoutId: string` to `AlbumPage`.
   - Add `DEFAULT_LAYOUT_ID` (the 3-photo default, matching `DEFAULT_PER_PAGE = 3`).

2. **Layout catalog** (`src/lib/layouts.ts`, new, pure)
   - `type LayoutNode = { kind: "slot" } | { kind: "split"; axis: "h" | "v"; children: LayoutNode[]; weights?: number[] }`.
   - `interface LayoutTemplate { id: string; label: string; count: number; node: LayoutNode }`.
   - `leafCount(node)` - count slots.
   - `CATALOG: LayoutTemplate[]` for counts 1-4:
     - 1: `single`
     - 2: `two-row` (h), `two-col` (v)
     - 3: `three-row` (h), `three-col` (v), `one-over-two`, `two-over-one`, `one-beside-two` (weighted)
     - 4: `four-row` (h), `grid-2x2`, `one-over-three`, `three-over-one`, `one-beside-three` (weighted)
   - `layoutsForCount(count)`, `getLayout(id)`, `defaultLayoutId(count)` (first template of that count; `single` for 1; auto id for 0 / >4).
   - `autoTemplate(count)` - balanced template for any count (rows of up to 3), used when no catalog entry exists.

3. **Engine** (`src/lib/layout.ts`, replace greedy packer)
   - `PlacedCell<T> { item: T; rx: number; ry: number; rw: number; rh: number; w: number; h: number }`.
   - `computeLayout(items, contentW, contentH, node, { density })`:
     - Recursively subdivide the content box per the node tree (structural gap between
       siblings, weighted or equal), producing one region rect per leaf, leaves in order.
     - For each region, contain-fit the photo (`boxH = min(rh, rw / ratio)`, `boxW = boxH * ratio`),
       scale by `fillFraction = 0.5 + 0.44 * clamp(density,0,100)/100`, center. Never above contain fit.
     - Map region + photo box to each item in order; return `{ cells }`.
   - Keep it pure and framework-free.

4. **Engine tests** (`src/lib/layout.test.ts`, rewrite) - see Test Plan below.

5. **Store** (`src/store.ts`)
   - `newPage()` seeds `layoutId: defaultLayoutId(0)`; `distribute` sets each page's
     `layoutId` to `defaultLayoutId(DEFAULT_PER_PAGE)` (or the page's real count).
   - Add `setPageLayout(pageId, layoutId)`.
   - Any mutation that changes a page's `photoIds.length` (`setPageCount`, `placeOnPage`,
     `removeFromPage`) re-syncs `layoutId` via a helper `syncLayout(page)` that keeps the
     current id if its `leafCount` still matches, else resets to `defaultLayoutId(newCount)`.

6. **LayoutThumb** (`src/components/LayoutThumb.tsx`, new)
   - Small SVG that recursively draws a `LayoutNode` as nested rectangles.

7. **PageCard** (`src/components/PageCard.tsx`)
   - Below the existing header row, render the layout picker: `layoutsForCount(count)`
     as `LayoutThumb` buttons, active one highlighted, `onClick -> setPageLayout`.
   - Hide the picker when `count < 1` or `count > 4`.

8. **Paper** (`src/components/Paper.tsx`)
   - Resolve the node: `getLayout(page.layoutId)?.node ?? autoTemplate(count)`.
   - Call the new engine; render each cell as an absolutely-positioned div at
     `(rx, ry, rw, rh)`, flex-centering the photo (`w x h`) + caption stack.

## Test Plan

| Module  | Scenario                                             | Expected                                          |
| ------- | ---------------------------------------------------- | ------------------------------------------------- |
| layout  | mixed portrait + landscape, any template + density   | every cell `w/h === item.ratio` (no crop)         |
| layout  | panorama (16:7) in a slot                            | contained: `w <= rw`, `h <= rh`, ratio intact     |
| layout  | any template                                         | every region inside the content box, no overflow  |
| layout  | photo box vs region                                  | `w <= rw + eps` and `h <= rh + eps` for all cells |
| layout  | density 20 vs 80, same template                      | higher density -> larger photo box                |
| layout  | region structure vs density                          | region rects identical at density 10 and 90       |
| layout  | `grid-2x2` on 4 items                                | 2 rows x 2 cols; region centers form a 2x2 grid   |
| layout  | `one-beside-two` weighted                            | left region wider than each right region          |
| layout  | empty items / zero box                               | `{ cells: [] }`                                    |
| layouts | `leafCount` for every catalog template               | equals the template's `count`                     |
| layouts | `defaultLayoutId(n)` for n in 1..4                   | returns a template whose `count === n`            |
| layouts | `autoTemplate(n)` for n = 5,7                        | `leafCount === n`                                 |
| store   | `setPageCount` changes count                         | `layoutId` resets to `defaultLayoutId(newCount)`  |
| store   | `setPageLayout` on one page                          | only that page's `layoutId` changes               |
| store   | drag place/remove crossing a count boundary          | `layoutId` re-synced to a valid template          |

## Tasks

- [x] 1 types
- [x] 2 catalog
- [x] 3 engine
- [x] 4 engine tests
- [x] 5 store
- [x] 6 LayoutThumb
- [x] 7 PageCard picker
- [x] 8 Paper region render
- [x] validate green
- [x] verified in the real app (Phase 5)
