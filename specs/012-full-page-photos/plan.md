# 012 - Implementation plan

## Steps (in order)

1. **Types** (`src/types.ts`):
   - `export type PageFill = "contain" | "cover";`
   - `export interface CropFocus { x: number; y: number; }` (0..1).
   - `AlbumPage.fullPage?: PageFill;` and `AlbumPage.fullPageFocus?: CropFocus;` with doc
     comments (undefined `fullPage` = Off; both effective only at one photo; focus used by
     cover; default centre).
   - `export const DEFAULT_CROP_FOCUS: CropFocus = { x: 0.5, y: 0.5 };`

2. **Pure lib** (`src/lib/fit.ts`, new):
   - `coverSourceRect(srcW, srcH, targetRatio, focus = DEFAULT_CROP_FOCUS): { sx; sy; sw;
     sh }` - the source rectangle of aspect `targetRatio` fully inside `srcW x srcH`
     (cover crop), positioned by `focus` along the overflowing axis (`0` = left/top,
     `1` = right/bottom). Pure; clamps the rect inside the source.

3. **Pure lib** (`src/lib/print.ts`):
   - `PageInput.fullPage?: PageFill`; `PhotoBox.cover?: boolean`.
   - `interiorPageGeometry`: when `fullPage` is set and there is one item, content box =
     media box; **contain** -> a contain-fit photo box centred in the media box;
     **cover** -> photo box = whole media box with `cover: true` and the page's `focus`.
     No title/subtitle/captions in full-page mode. (`PageInput` also carries `focus`.)

4. **Engine/lib tests** (`src/lib/fit.test.ts`, `src/lib/print.test.ts`).

5. **Store** (`src/store.ts`):
   - `setPageFullPage(pageId, mode: PageFill | null)` (null clears).
   - `setPageFullPageFocus(pageId, focus: CropFocus)` (clamps each axis to `[0,1]`).
   - In the count-sync path (`syncLayout` or alongside it), clear `fullPage` when a page's
     photo count is not 1, so a full-page page reverts when it gains/loses photos.

6. **Store tests** (`src/store.test.ts`): set/clear mode; set + clamp focus; count change
   clears mode.

7. **Print painter** (`src/lib/pdf-export.ts`):
   - `ExportPageLike.fullPage?` + `focus?`; pass through to `interiorPageGeometry`.
   - `drawPhoto` / `photoJpegBytes`: a `cover` box crops the source with
     `coverSourceRect(..., focus)` (canvas 9-arg `drawImage`) so the JPEG fills the box
     with no distortion; contain boxes keep the current path.

8. **Components**:
   - `Paper.tsx`: when full page, render `<img>` filling the paper box with
     `object-contain` (Fit) or `object-cover` + `object-position` (Fill); skip
     header/caption and the region layout. In Fill, a small pointer-drag pans the photo
     along its overflowing axis and calls `setPageFullPageFocus` (keep a remove button).
     Off is unchanged.
   - `Thumb.tsx`: `fullPage?` + `focus?` props; object-contain/cover + object-position at
     nominal size (read-only).
   - `PreviewPaper.tsx`: full-page branch in the page leaf (object-contain/cover + focus).
   - `PageRail.tsx` / `BookPreview.tsx`: pass `page.fullPage` and `page.fullPageFocus`.
   - `PageCard.tsx`: Off / Fit / Fill segmented control (only when count === 1); Fill
     marked as cropping; hide the whitespace slider when full page is on.
   - `ExportPanel.tsx`: include `fullPage` and `fullPageFocus` in `ExportPageLike`.

## Test Plan

| Module | Scenario                                                    | Expected                                                           |
| ------ | ---------------------------------------------------------- | ------------------------------------------------------------------ |
| fit    | `coverSourceRect` wide source, square target (centre)     | full height, centred horizontally, `sw/sh === 1`, within bounds    |
| fit    | `coverSourceRect` tall source, landscape target (centre)  | full width, centred vertically, `sw/sh === target`, within bounds  |
| fit    | `coverSourceRect` source ratio === target                 | whole source (sx=sy=0, sw=srcW, sh=srcH)                           |
| fit    | `coverSourceRect` focus x=0 / x=1 on a wide source        | crop pinned to left (`sx===0`) / right (`sx+sw===srcW`)            |
| fit    | `coverSourceRect` focus y extremes on a tall source       | crop pinned to top (`sy===0`) / bottom (`sy+sh===srcH`)            |
| fit    | `coverSourceRect` focus out of range                      | clamped; rect stays within `srcW x srcH`                           |
| fit    | `coverSourceRect` never exceeds the source                | `sx>=0, sy>=0, sx+sw<=srcW, sy+sh<=srcH`                            |
| print  | full-page **contain**, photo ratio != page                | one photo box, `w/h === ratio`, box inside media box (no overflow) |
| print  | full-page **contain**, maximized                          | box touches a media-box edge (cannot grow); no title/captions      |
| print  | full-page **contain**, photo ratio === page               | box === media box (fills), `w/h === ratio`                         |
| print  | full-page **cover**                                       | photo box === media box, `cover === true`, focus carried, no text  |
| print  | normal page (no `fullPage`)                               | unchanged (regression: existing print tests still pass)            |
| store  | `setPageFullPage(id, "cover")`                            | that page's `fullPage === "cover"`, others unchanged               |
| store  | `setPageFullPage(id, null)`                               | `fullPage` undefined                                               |
| store  | `setPageFullPageFocus(id, {x:2,y:-1})`                    | stored focus clamped to `{x:1,y:0}`                                |
| store  | full-page page gains a 2nd photo                          | `fullPage` cleared (count !== 1)                                    |

Ratio + fit assertions live in `fit.test.ts` (cover crop keeps the target aspect within
the source, i.e. proportional, no distortion) and `print.test.ts` (contain box
`w/h === ratio` and fits the media box). The engine (`layout.ts`) is unchanged, so its
existing ratio/fit tests still guard every normal page.

## Verify in-app (Phase 5)

- `npm run build && npm run preview`; Load an example, set a page to 1 photo.
- Toggle Off / Fit / Fill; confirm Fit is edge-to-edge with paper bands (no crop) and
  Fill covers with no distortion; in Fill, drag the photo and confirm the crop moves along
  the overflowing axis and sticks; check a portrait and a panorama on a square page;
  confirm the thumbnail and the book preview match the crop; light and dark.
