# Spec 033: Border follows the mask shape

## Context

A photo can carry both a decorative **Border** frame (spec 019) and a decorative **mask** (spec
018). Today they do not compose visually: `FramedPhoto` paints the Border as a filled rectangle
(the whole outer box) and clips only the inner photo to the mask. So a circle-masked photo inside a
Border shows a **rectangular** mat around a **circular** photo, which looks wrong.

The request: the border should **follow the mask shape**. A circle-masked photo with a Border should
read as a circular ring of mat colour around the circular photo; an oval mask gives an oval ring, an
arch mask an arch, and so on.

## Goals

- When a photo has a **Border** frame **and** a mask, clip the mat (the coloured outer box) to the
  same mask shape, so the border becomes a shaped ring around the shaped photo.
- Keep the ring uniform: the Border already sizes its outer box so the inner photo area is
  concentric and inset by a uniform border width, so clipping outer and inner to the same shape
  yields an even ring.
- Preserve the drop shadow so the framed unit still lifts off the page: a clipped box loses a
  `box-shadow`, so switch to a `drop-shadow()` filter that follows the clipped silhouette.

## Non-goals

- **Polaroid** frames are unchanged: a Polaroid is a square window over a note band, not a mat that
  can take a shape. A mask on a Polaroid keeps today's behaviour (the window is masked; the frame
  is not reshaped).
- No change to unframed masked photos (already clipped by `CroppedImg`) or to the default subtle
  frame on unframed photos.
- No engine change, no data-model change, no new controls. This composes two existing opt-in
  decorations.
- Print (PDF) is unaffected: masks are screen-only (they are not applied in `pdf-export`), so a
  Border-framed masked photo still prints as a rectangular mat over the full photo, exactly as
  masks behave everywhere else today. This feature is on-screen only, like the mask it follows.

## Requirements

1. In `FramedPhoto`, for a non-square (Border) style with a known mask, apply `maskClipValue(mask)`
   to the outer mat box (the element carrying `background: color`).
2. When the mat is clipped, replace its `box-shadow` with an equivalent `filter: drop-shadow(...)`
   so the shadow follows the shape (a `box-shadow` would be clipped away). Unmasked frames keep the
   current `box-shadow`.
3. The inner photo keeps its existing mask clip (unchanged): the two concentric same-shape clips
   produce the ring.
4. An absent or unknown mask leaves the Border exactly as today (rectangular mat + box-shadow).
5. Polaroid (square) frames ignore this entirely.

## Acceptance criteria

- [x] A Border-framed photo with a **circle** mask shows a circular mat ring around a circular
      photo, with a uniform ring width, on a portrait and on a landscape photo.
- [x] An **oval** / **rounded** / **arch** mask gives a mat ring of that shape.
- [x] The framed unit still casts a soft shadow that follows the shape.
- [x] A Border-framed photo with **no** mask is visually unchanged (rectangular mat + shadow).
- [x] A Polaroid frame is unchanged whether or not a mask is set.
- [x] The photo is never cropped or distorted beyond the mask's existing opt-in clip; ratios are
      unchanged (no engine involvement).

## Edge cases

- Landscape photo + circle mask: the outer box is wider than tall, so the mat circle uses the
  height; the transparent sides let the page show through (correct - the border is a circle).
- Thick border + small photo: the inner area shrinks but stays concentric; the ring stays even.
- Unknown/stale mask id: `maskClipValue` returns undefined, so the mat stays rectangular (no clip).

## Architecture (flow + files)

Only `src/components/FramedPhoto.tsx` changes: the outer mat `<div>` gains `clipPath:
maskClipValue(mask)` and, when masked, a `drop-shadow()` filter instead of `box-shadow`. The clip
value comes from the existing pure `maskClipValue` in `src/lib/masks.ts`. No other file changes.

## Invariant

The layout engine is untouched: `computeLayout` and `photoLayoutRatio` are unchanged, so every
cell still carries the photo's (framed) ratio and no photo is resized non-proportionally. The mask
is the existing opt-in clip (spec 018); the border is additive (spec 019). This spec only makes the
existing mat follow the existing mask shape.
