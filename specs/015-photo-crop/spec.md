# 015 - Photo crop tool (opt-in crop rectangle)

## Context

No-crop is Passepartout's default and stays. But it is a default, not a ban: users want to
be able to crop a photo when they choose. Spec 012 (full-page Fill) and the (unmerged)
per-cell Fill were cover-crops tied to a cell shape, and the per-cell one was undiscoverable
(a tiny hover icon). This spec adds the crop users actually asked for: a clear **Crop**
button that opens a **crop rectangle** on the photo (free format), decoupled from the cell.

A cropped photo simply becomes a photo of the kept rectangle: its effective ratio changes
and it flows through the layout engine and the print exactly like any other photo, still
contain-fit in its cell (no forced fill, no distortion). Cropping is off by default and
always an explicit choice.

## The one rule

No-crop is the default: a photo with no crop is the whole image, contained, never clipped.
The crop is an explicit, per-photo opt-in that keeps a chosen sub-rectangle of the source;
the KEPT region is then shown undistorted (contain-fit), so nothing is ever stretched. Only
photos the user explicitly crops are clipped, and only to the rectangle they chose.

## Goals

- A discoverable **Crop** button per photo (in Edit layout), opening a crop editor.
- A crop editor: the full source image with a draggable crop rectangle (corner + edge
  handles, free aspect), drag inside to move, plus Reset and Done / Cancel.
- The crop is stored per photo; its effective ratio drives layout, and it renders and prints
  the cropped region everywhere (page, thumbnails, book preview, PDF, covers).

## Non-goals

- No aspect presets, rotation, straightening, masks, or filters (just a free rectangle).
- No change to the no-crop default, the layout engine, full-page mode (spec 012), or covers'
  own model.

## Architecture

A crop is a normalized sub-rectangle of the source; everything downstream uses the photo's
**effective ratio** and renders the crop.

```
Photo.crop?: { x, y, w, h }   // normalized 0..1 kept sub-rectangle; undefined = whole image

effectiveRatio(photo) = photo.ratio * (crop.w / crop.h)   // src ratio * kept aspect factor

lib/crop.ts (PURE): DEFAULT_CROP, effectiveRatio, clampCrop, moveCropRect, resizeCropRect
  (corner/edge, clamped to [0,1], min size), and cropImgBox(crop, boxW, boxH) -> the img
  width/height/offset to render the crop inside a box (screen).

engine: unchanged. Callers pass effectiveRatio(photo) as the item's ratio, so the photo is
  laid out (contain-fit) as a photo of the cropped shape.

render (Paper Cell, Thumb, PreviewPaper, CoverCard, full-page): a shared CroppedImg draws
  the photo into its box via cropImgBox inside an overflow-hidden frame; an un-cropped photo
  (crop full) is the plain image as today.

print (pdf-export.ts): the source is cropped at re-encode (canvas 9-arg drawImage over the
  crop rect in source pixels) before drawing into the box; print.ts is unchanged (its boxes
  already use the effective ratio via the item ratio). A full crop is a no-op.

editor (new CropEditor overlay): opened by the Crop button; shows the full image with a
  crop rectangle + handles; Done writes Photo.crop via store.setPhotoCrop.
```

Files:

- `src/types.ts`: `Photo.crop?: CropRect`.
- `src/lib/crop.ts` (new, PURE) + `crop.test.ts`.
- `src/store.ts` (+ tests): `setPhotoCrop(photoId, crop | null)`.
- `src/lib/pdf-export.ts`: crop the source at re-encode (a plain photo path unchanged).
- `src/components/CroppedImg.tsx` (new): render a (possibly cropped) photo into a box.
- `src/components/Paper.tsx`, `Thumb.tsx`, `PreviewPaper.tsx`, `CoverCard.tsx`: use
  `effectiveRatio` for layout and `CroppedImg` (or its style) for rendering; a **Crop**
  button in the Edit-layout cell toolbar opens the editor.
- `src/components/CropEditor.tsx` (new): the crop overlay editor.
- `src/lib/project.ts`: `crop` travels with the photo (StoredPhoto), no migration.

## Requirements

1. `Photo.crop?` normalized rect; `undefined` = the whole image (no crop, the default).
2. A clear **Crop** button per photo in Edit layout opens the crop editor.
3. The editor shows the full image with a draggable crop rectangle: corner + edge handles
   resize it (free aspect, min size), dragging inside moves it, all clamped to the image.
   Reset clears the crop; Done applies; Cancel discards.
4. A cropped photo lays out by its effective ratio (contain-fit in its cell, whitespace as
   usual) and renders the cropped region on the page, in thumbnails, the book preview and
   the export PDF, undistorted.
5. `setPhotoCrop` writes/clears the crop; it persists and survives reload and duplication.
6. Composes with the rest: a cropped photo works in any layout/cell, in full-page mode
   (spec 012 crops then covers), and on covers.

## Acceptance criteria

- [x] A Crop button is visible per photo in Edit layout and opens the editor.
- [x] The crop rectangle can be moved and resized freely (corners + edges), clamped to the
      image; Reset/Done/Cancel behave.
- [x] After Done, the photo shows only the cropped region, laid out by its new ratio, with
      no distortion; page, thumbnails, book preview and PDF all match.
- [x] An un-cropped photo is unchanged (whole image, contained).
- [x] The crop persists across reload and project duplication.
- [x] `npm run validate` passes; the pure crop math and effective ratio are unit-tested.

## Edge cases

- **No crop**: `crop` undefined -> whole image, contained (today's behaviour).
- **Full-rect crop** (`0,0,1,1`): identical to no crop.
- **Extreme crop** (tiny rect): effective ratio is that of the kept rect; still contain-fit
  (may be very wide/tall); min crop size prevents a zero-area rect.
- **Cropped + full-page Fill (spec 012)**: crop first (effective ratio), then cover the
  page; both are proportional, no distortion.
- **Photo re-used after crop / count change**: the crop lives on the Photo, so it follows
  the photo wherever it is placed.
- **Missing blob**: same graceful degrade; the crop rect is just metadata.
