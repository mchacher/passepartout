# 015 - Implementation plan

## Steps (in order)

1. **Types** (`src/types.ts`): `export interface CropRect { x: number; y: number; w: number;
   h: number }` (normalized 0..1); `Photo.crop?: CropRect`.

2. **Pure lib** (`src/lib/crop.ts`, new):
   - `DEFAULT_CROP = { x: 0, y: 0, w: 1, h: 1 }` and `MIN_CROP` (e.g. 0.05).
   - `effectiveRatio(ratio, crop?)` = `ratio * (crop.w / crop.h)` (ratio when no crop).
   - `clampCrop(crop)` -> inside [0,1], w/h >= MIN_CROP, x+w <= 1, y+h <= 1.
   - `moveCropRect(crop, dx, dy)` (normalized deltas, clamped).
   - `resizeCropRect(crop, handle, dx, dy)` for the 8 handles (4 corners + 4 edges),
     min size, kept inside the image.
   - `cropImgBox(crop, boxW, boxH)` -> `{ w, h, ox, oy }`: the displayed image size and
     top-left offset so the crop rect exactly fills `boxW x boxH` (for the screen render).

3. **Pure tests** (`src/lib/crop.test.ts`): effectiveRatio; clamp; move/resize handles;
   cropImgBox maps the crop to the box (full crop => image == box, offset 0).

4. **Store** (`src/store.ts` + tests): `setPhotoCrop(photoId, crop | null)` (clamps; null
   clears). The crop travels in `StoredPhoto` via the existing serialize/duplicate spread
   (verify project.ts needs no change).

5. **Render helper** (`src/components/CroppedImg.tsx`, new): given `photo`, box `w/h` and
   optional class, render the plain image when uncropped, else an `overflow-hidden` frame
   with the image sized/offset by `cropImgBox`. Used by every renderer.

6. **Effective ratio + render everywhere**:
   - `Paper.tsx`: build engine items with `effectiveRatio(photo)`; render cells with
     `CroppedImg`. Add a **Crop** button to the Edit-layout cell toolbar (clear label/icon)
     that opens `CropEditor` for that photo.
   - `Thumb.tsx`, `PreviewPaper.tsx`, `CoverCard.tsx`: `effectiveRatio` for layout +
     `CroppedImg` (or the same style) for render.
   - Full-page (spec 012) render + `print.ts` items use `effectiveRatio` too.

7. **Print** (`src/lib/pdf-export.ts`): in `photoJpegBytes`, when the photo has a crop, use
   the crop rect (in source px) as the canvas source rectangle (9-arg `drawImage`); the box
   already has the effective ratio, so contain stays exact. Thread the crop to the painter
   (via `ExportPageLike` items). A full/absent crop keeps the current path.

8. **Crop editor** (`src/components/CropEditor.tsx`, new): a focused overlay. Shows the full
   image; a crop rectangle with 4 corner + 4 edge handles (drag to resize via
   `resizeCropRect`), drag inside to move (`moveCropRect`); the outside is dimmed; Reset /
   Cancel / Done (writes via `setPhotoCrop`). Keyboard Escape = cancel.

## Test Plan

| Module | Scenario                                                    | Expected                                                        |
| ------ | ---------------------------------------------------------- | --------------------------------------------------------------- |
| crop   | `effectiveRatio` no crop / half-width crop                 | `ratio` / `ratio * (0.5/1)`                                     |
| crop   | `clampCrop` out of range / below min                       | pulled inside [0,1]; w/h >= MIN_CROP; x+w<=1                     |
| crop   | `moveCropRect` past an edge                                | clamped so the rect stays inside the image                      |
| crop   | `resizeCropRect` each corner/edge                          | that side moves, opposite fixed, min size, in-bounds            |
| crop   | `cropImgBox` full crop                                     | image size == box, offset 0 (plain render)                      |
| crop   | `cropImgBox` sub-rect                                      | image scaled so the crop fills the box; offset places the crop  |
| store  | `setPhotoCrop` sets / clamps / clears                      | crop stored/clamped; null clears                                |

Engine ratio + fit assertions are unaffected (the engine still contain-fits whatever ratio
it is given; the effective ratio is just the input). The crop render keeps the kept region's
aspect, so nothing is distorted.

## Verify in-app (Phase 5)

- `npm run build && npm run preview`; Edit layout, click Crop on a photo, drag the crop
  rectangle (corners + edges + move), Done. Confirm the photo shows the cropped region,
  re-fits its cell by the new ratio, no distortion; check the thumbnail, book preview and a
  PDF export match; Reset restores the whole image. Light and dark.
