# 001 - Page layouts

## Context

Today a page has two controls: a photo **count** (1-4) and a **whitespace** slider.
The arrangement itself is *emergent*: `computeLayout` greedily packs photos into
centered rows, and the whitespace slider changes the target row height, which as a
side effect re-groups photos into different rows. Whitespace and arrangement are
therefore tangled: dragging the slider silently reshuffles the page, and the user
can never say "I want these three side by side, just with more air".

This is the wrong mental model. A page should **offer explicit layouts** (fixed
arrangements) and whitespace should only manage the space *within* a chosen,
frozen layout.

## Goals

- Introduce a first-class **layout** per page: an explicit, selectable arrangement.
- Offer a catalog of layouts per photo count (1-4), including **row splits and
  grid/column splits** (e.g. `2x2 grid`, `1 big beside 2 stacked`).
- Make **whitespace scale sizes within a frozen layout only** - it never re-groups
  photos or changes the region structure.
- Keep the one rule intact: every photo keeps its native aspect ratio and is never
  clipped. A photo is *contained* (fit + centered) inside its slot; whitespace
  absorbs the difference between the photo ratio and the slot ratio.

## Non-goals

- No crop / focal-point / fill-slot behavior (out of scope by definition).
- No drag-to-resize of individual slots or free-form layout editing.
- No persistence format change beyond adding a `layoutId` string to a page.
- No per-slot photo assignment UI: photos fill the layout slots in their existing
  page order (leaf order = photo order).

## Requirements

1. A page stores a `layoutId` alongside its `density` and `photoIds`.
2. A **layout catalog** (pure data) defines, per photo count 1-4, a set of named
   templates. Each template is a nested split tree of the page box:
   - a **slot** (holds one photo), or
   - a **split** along an axis (`h` = side by side columns, `v` = stacked rows)
     into children, with optional weights for asymmetric templates.
   Leaves are visited in order and mapped to the page's photos in order.
3. The engine `computeLayout(items, w, h, node, { density })` returns, for each
   photo, its **region rect** and its **photo box** (`w/h === ratio` exactly),
   the photo box fit-and-centered inside the region. Nothing overflows the page.
4. **Whitespace** is chosen per page in discrete levels (1 .. `WHITESPACE_LEVELS`,
   currently 8): level 1 = least white (photos fill their region), the top level =
   most white. The level maps to the engine's continuous `density` and controls only
   a `fillFraction` (how much of its region a photo occupies); it leaves the region
   structure untouched. Lower level = bigger photos, same arrangement.
5. The page header keeps the **1-4 count buttons** and adds a **layout picker**:
   small SVG thumbnails of the templates available for the current count. Picking
   one sets `layoutId`.
6. Changing the count (buttons or drag) resets `layoutId` to the default template
   for the new count. If a page's photo count has no catalog entry (0, or >4 via
   drag), the engine falls back to an auto-generated balanced template and the
   picker is hidden.

## Architecture

New / changed files:

- `src/lib/layouts.ts` (new) - `LayoutNode` type, the template **catalog** keyed by
  count, `getLayout(id)`, `defaultLayoutId(count)`, `layoutsForCount(count)`,
  `autoTemplate(count)` (balanced fallback for any count), and `leafCount(node)`.
- `src/lib/layout.ts` (changed) - engine now consumes a `LayoutNode` and returns
  absolute region + photo-box cells. The greedy row packer is replaced.
- `src/lib/layout.test.ts` (changed) - rewritten for the new contract (ratio, fit,
  density monotonicity, panorama contained, per-template structure).
- `src/types.ts` (changed) - `AlbumPage.layoutId`, `DEFAULT_LAYOUT_ID`.
- `src/store.ts` (changed) - set `layoutId` on new pages; `setPageLayout`; reset
  `layoutId` to the count default whenever a page's photo count changes.
- `src/components/PageCard.tsx` (changed) - render the layout picker.
- `src/components/LayoutThumb.tsx` (new) - tiny SVG that draws a `LayoutNode`.
- `src/components/Paper.tsx` (changed) - render absolute region cells (photo +
  caption centered in each region) instead of flex rows.

Flow (unchanged in spirit, engine input gains the template):

```
PageCard (count + layout picker) -> store (photoIds, density, layoutId)
  -> Paper measures content box
    -> computeLayout(items, w, h, getLayout(layoutId).node, { density })  [pure]
      -> region rects + ratio-preserved photo boxes, centered, no overflow
```

## Density semantics

Region rects are a pure function of the template and the content box (with a fixed
structural gap between siblings) - **independent of the whitespace level**. The level
maps to a density (`whitespaceToDensity`: level 1 -> 100, top level -> 0). Within each
region, the photo is contain-fit then scaled by `fillFraction = 0.5 + 0.5 * density/100`
(range 0.50 .. 1.00) and centered. At level 1 the photo fills its region's constraining
dimension; it is never scaled above the contain fit, so the ratio is kept and the fixed
inter-region gap is the guaranteed minimum whitespace. So the whitespace level only
makes the photos breathe; the arrangement never moves.

## Acceptance criteria

- [x] A page has a layout picker showing the templates for its current count.
- [x] Selecting a template changes the arrangement immediately; the whitespace
      slider no longer changes the arrangement, only the photo sizes.
- [x] Grid templates (`2x2`, `1 beside 2/3`, `1 over 2/3`) render correctly.
- [x] Every photo keeps its exact aspect ratio in every template and at every
      density (verified by test + visually: max rendered ratio deviation 0.9%,
      pure pixel rounding).
- [x] No photo box or region overflows the page at any density or format.
- [x] Changing the count resets the layout to that count's default.
- [x] Pages with >4 photos (drag) still render via the auto template; picker hidden.
- [x] `npm run validate` is green.

## Edge cases

| Case                          | Expected                                                        |
| ----------------------------- | -------------------------------------------------------------- |
| Empty page (0 photos)         | No cells; picker hidden; empty-state hint shown.               |
| 1 photo                       | Single-slot layout; picker shows just the one (or hidden).     |
| Panorama (16:7) in a slot     | Contained inside its region, ratio intact, whitespace around.  |
| Portrait photo in wide slot   | Contained, tall, big side whitespace, never stretched.         |
| Portrait page format          | Regions computed over the portrait box; templates still valid. |
| >4 photos via drag            | Auto balanced template (rows of up to 3); picker hidden.       |
| Count changed 3 -> 2          | Layout resets to the 2-photo default (side by side).           |
| Whitespace dragged full range | Photos grow/shrink; region structure identical throughout.     |
| Caption in the tightest slot  | At high density the photo fills its region, so a caption sits in the inter-region gap. It never clips the photo (no `overflow:hidden`); the gap is whitespace. Lower the page whitespace a notch if a caption feels cramped. |
