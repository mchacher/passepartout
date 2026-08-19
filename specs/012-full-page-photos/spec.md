# 012 - Full-page photos

## Context

Every photo today lives inside a layout region with a page margin around it: even a
single photo at whitespace level 1 stops short of the page edge. The roadmap's
"full-page photos" asks for the "one big photo per page" look, edge to edge.

A photo only truly fills all four edges of a fixed print page when its ratio matches the
page ratio. Otherwise "full page" means either paper bands on the non-matching sides
(no crop) or cropping the photo to the page ratio (a clip). The page is a physical Blurb
trim shared by the whole interior, so adapting the page to the photo is not an option.

**Product decision (the maintainer's call).** Passepartout offers *both*, with no-crop as
the default: this is the product's differentiator (most tools crop by default). Full page
defaults to a no-crop fit; a clearly labelled per-page opt-in accepts a crop to fill.

## Goals

- A per-page "Page fill" control on single-photo pages with three states:
  - **Off** (default) - the normal page (margin, layout, whitespace, title).
  - **Fit** - full page, no crop: the photo is maximized to the page edges (into the
    print bleed); truly edge to edge when its ratio matches the page, otherwise paper
    bands on the non-matching sides. Never clipped.
  - **Fill** - full page, cropped: the photo covers all four edges, cropped to the page
    ratio. An explicit opt-in that clips (the only place in the app that ever does).
- **Reposition the crop in Fill**: drag the photo to choose which part is kept (a
  per-page crop focus, centre by default). Only the overflowing axis pans.
- Faithful on screen and in the print PDF (into the bleed), reusing the pure geometry.

## Non-goals

- No adjustable crop focus for **Fit** (Fit never crops, so there is nothing to pan; only
  **Fill** exposes a crop focus).
- No zoom / scale control on the crop (the cover scale is fixed; only the focus moves).
- No full-page mode for multi-photo pages (single photo only; ignored otherwise).
- No change to how normal (Off) pages render. The contain-fit guarantee is untouched for
  every photo that is not explicitly set to **Fill**.
- No new book size or bleed behaviour; reuses the existing media/trim/bleed geometry.

## The one rule (no crop) - how this feature relates to it

The founding rule is "a photo's aspect ratio is never changed and a photo is never
clipped." This feature keeps **both halves as the default**:

- **Off** and **Fit** never clip and never distort. The engine stays pure and
  contain-only; **Fit** is just a contain-fit with a zero margin into the bleed.
- **Fill** is the single, explicit, per-page opt-in that **clips** - and even then it
  **never distorts**: the photo is scaled proportionally (cover-fit), so `w / h` still
  equals the photo's ratio; only the overflow is cut. It is opt-in, off by default, and
  labelled as cropping. Every un-opted photo keeps the full no-crop guarantee.

So ratio preservation remains universal (contain and cover both keep `w/h === ratio`);
only **Fill** trades the "never clipped" half, by explicit choice.

## Architecture

A per-page field drives a rendering branch; the engine is unchanged.

```
AlbumPage.fullPage?: "contain" | "cover"      (undefined = Off; effective only when 1 photo)
AlbumPage.fullPageFocus?: { x: number; y: number }   (0..1, default 0.5/0.5; used by cover)

Off      -> existing path (computeLayout in the margin-inset content box)
Fit/Fill -> full page:
  screen  (Paper / Thumb / PreviewPaper): <img> filling the paper box with
           object-contain (Fit) or object-cover + object-position (Fill); no header/caption
           Fill on the editor page is drag-pannable -> updates fullPageFocus
  print   (print.ts): content box = full media box (into bleed)
             Fit  -> contain-fit photo box centred in the media box
             Fill -> photo box = whole media box, flagged cover, carries the focus
           (pdf-export.ts): a cover photo is cropped at re-encode time via
           coverSourceRect(srcW, srcH, targetRatio, focus) (canvas 9-arg drawImage), so the
           JPEG fills the box with no distortion and no PDF clipping needed
```

The screen `object-position` and the print `coverSourceRect` share the same focus
semantics: focus `0` keeps the left/top edge, `1` keeps the right/bottom, `0.5` centres,
so the editor pan and the exported crop always agree.

Files:

- `src/types.ts` (edit): `PageFill` type + `AlbumPage.fullPage?` + `fullPageFocus?`.
- `src/lib/fit.ts` (new, PURE): `coverSourceRect(srcW, srcH, targetRatio, focus)` crop rect.
- `src/lib/fit.test.ts` (new).
- `src/lib/print.ts` (edit): `PageInput.fullPage`, full-page geometry, `PhotoBox.cover`.
- `src/lib/print.test.ts` (edit): full-page geometry cases.
- `src/store.ts` (edit): `setPageFullPage` + `setPageFullPageFocus`; clear `fullPage` when
  a page leaves 1 photo.
- `src/store.test.ts` (edit).
- `src/lib/pdf-export.ts` (edit): thread `fullPage`; cover crop at re-encode.
- `src/components/Paper.tsx`, `Thumb.tsx`, `PreviewPaper.tsx`, `PageRail.tsx`,
  `BookPreview.tsx`, `PageCard.tsx`, `ExportPanel.tsx` (edit): render + control + wiring.

No change to `src/lib/layout.ts` (the engine stays pure and contain-only).

## Requirements

1. `AlbumPage.fullPage?: "contain" | "cover"`; `undefined` = Off. Effective only when the
   page has exactly one photo; cleared automatically when the count leaves 1.
2. PageCard shows a "Page fill" segmented control (Off / Fit / Fill) only when the page
   has exactly one photo. **Fill** is visibly marked as cropping. Selecting Fit or Fill
   hides the whitespace slider (irrelevant at full page).
3. **Fit** renders the photo maximized to the page edges, contain-fit (no crop, paper
   bands where the ratio differs), into the print bleed. Title/subtitle/caption hidden.
4. **Fill** renders the photo covering the whole page (cropped to the page ratio), into
   the print bleed on all sides. Title/subtitle/caption hidden. Never distorted.
5. **Crop focus (Fill only)**: `AlbumPage.fullPageFocus` (`{x,y}` in 0..1, default
   `0.5/0.5`). On the editor page the Fill photo is drag-pannable along its overflowing
   axis to set the focus; `Store.setPageFullPageFocus` clamps to `[0,1]`. When the photo
   ratio matches the page (no overflow), there is nothing to pan.
6. Screen (`Paper`), thumbnails (`Thumb`, so `PageRail`), and the book preview
   (`PreviewPaper` / `BookPreview`) all reflect the mode and the focus faithfully
   (`object-position`).
7. The print PDF (`print.ts` + `pdf-export.ts`) produces Fit and Fill into the media box
   (bleed); the Fill crop is taken at re-encode with the focus, so nothing is distorted
   and the print matches the editor.

## Acceptance criteria

- [x] Single-photo page shows the Off / Fit / Fill control; multi-photo pages do not.
- [x] Off is unchanged from today.
- [x] Fit maximizes the photo to the page edges with no crop; a ratio-matching photo goes
      truly edge to edge, a non-matching one shows paper bands, never clipped.
- [x] Fill covers the whole page, cropped, with no distortion (ratio preserved).
- [x] In Fill, dragging the photo repositions the crop (overflowing axis only) and
      persists; a ratio-matching photo has nothing to pan.
- [x] Adding a second photo to a full-page page reverts it to a normal multi-photo page.
- [x] Whitespace slider is hidden in Fit/Fill; title/subtitle/caption are hidden.
- [x] Thumbnails and the book preview match the page render, including the crop focus.
- [x] Export PDF renders Fit and Fill into the bleed; the exported Fill photo is cropped
      at the chosen focus, not squished.
- [x] `npm run validate` passes.

## Edge cases

- **Photo ratio == page ratio**: Fit already fills all four edges (Fill is identical);
  nothing to pan (no overflow on either axis).
- **Panorama on a square page, Fit**: touches left/right edges, paper bands top/bottom,
  no crop; **Fill**: covers, left/right of the panorama pannable (the wide axis overflows),
  top/bottom fixed.
- **Portrait photo, landscape page**: symmetric (vertical axis pans).
- **Focus out of range / missing**: clamped to `[0,1]`; absent focus defaults to centre.
- **Count leaves 1** (second photo added, or the photo removed): `fullPage` cleared; the
  page falls back to its normal layout.
- **Missing photo blob**: same graceful degrade as today (paper shows, no image).
- **Whitespace value** is preserved in state while Fit/Fill hides the slider, so turning
  full page Off restores the previous whitespace.
