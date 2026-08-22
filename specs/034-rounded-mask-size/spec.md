# Spec 034: Single rounded mask with a size sub-control and a constant radius

## Context

Spec 018/#40 shipped the rounded-corner mask as **three separate catalog entries**
(`rounded-sm` / `rounded` / `rounded-lg`), each an objectBoundingBox SVG path. Two problems:

1. Three near-identical entries clutter the mask picker. The user wants **one** "Rounded" mask and,
   below it, a **size sub-control** (like a frame's border-width chooser).
2. Because the path is in objectBoundingBox units, the corner radius scales with each box
   dimension, so the corners are **elliptical** and change with the photo's aspect (a wide photo
   gets wide corners). The user wants a **constant, circular radius** that does **not** follow the
   photo's format.

## Goals

- One "Rounded" mask entry in the picker; when it is selected, a size sub-control (three sizes)
  appears below the shapes, mirroring the frame border-width UX (spec 019).
- The rounded corner is a **quarter-circle of a constant radius** (equal on all four corners and on
  both axes), independent of the photo's aspect ratio. A portrait and a landscape with the same
  shorter side get the same corner radius.
- The size is a per-photo choice, persisted with the album.
- Composes with spec 033 (a Border frame follows the mask shape): the border ring is rounded with
  the same constant radius.

## Non-goals

- No change to the other masks (circle, oval, arch) or to the frames.
- No change to the layout engine or the no-crop rule (a mask is the existing opt-in clip).
- Masks stay screen-only (not applied in the PDF export), as today.

## Requirements

1. **Data model**: add `Photo.maskRadius?: number` - the rounded-corner radius as a fraction of the
   box's **shorter** side. It persists automatically (`StoredPhoto` spreads all `Photo` fields, like
   `frameWidth`). Only meaningful when `mask === "rounded"`.
2. **Catalog** (`src/lib/masks.ts`): collapse the three rounded entries into a single
   `{ id: "rounded", name: "Rounded" }`, marked as size-parameterized. Remove `rounded-sm` and
   `rounded-lg`. Add `ROUNDED_SIZES` (three `{ id, label, value }`, value = radius fraction of the
   shorter side) + `DEFAULT_ROUNDED_SIZE` + `roundedRadiusOf(v)` (coerce/clamp), mirroring
   `BORDER_WIDTHS` / `borderWidthOf`.
3. **Clip resolution**: `maskClipValue(id, ctx?)` takes an optional `ctx = { w, h, radius }`. For the
   rounded mask it returns `inset(0 round ${roundedRadiusOf(radius) * Math.min(w, h)}px)` - a
   constant circular radius, so the corners never stretch with the aspect ratio. Circle stays
   `circle(closest-side)`; oval and arch stay `url(#pp-mask-<id>)`.
4. **Store**: `setPhotoMaskRadius(photoId, value)` (coerced via `roundedRadiusOf`), mirroring
   `setPhotoFrameWidth`.
5. **UI** (`PageCard` mask popover): a single "Rounded" shape button; when the selected photo's mask
   is `rounded`, render a size sub-control (three buttons) under the shapes that calls
   `setPhotoMaskRadius`, mirroring the border-width sub-control.
6. **Renderers**: `CroppedImg`, `Thumb`, `FramedPhoto` (mat and inner photo) and the picker preview
   pass their box `w`/`h` and the photo's `maskRadius` to `maskClipValue`. The picker's rounded
   preview uses the default size.
7. **Migration**: on load, a photo whose `mask` is the retired `rounded-sm` / `rounded-lg` is mapped
   to `rounded` with the matching `maskRadius`, so v0.5.0 albums keep their look.
8. **i18n**: remove `mask.rounded-sm` / `mask.rounded-lg`; add `roundedSize.<id>` labels (EN + FR).

## Acceptance criteria

- [x] The mask picker shows one "Rounded" shape; selecting it reveals a three-way size sub-control.
- [x] Changing the size changes the corner radius live; the choice is remembered after reload.
- [x] The rounded corners are circular (equal radius on both axes) and identical on a portrait and a
      landscape photo of the same shorter side (they do not follow the photo format).
- [x] With a Border frame, the border ring is rounded with the same constant radius (spec 033).
- [x] A v0.5.0 album using `rounded-sm` / `rounded-lg` still shows a rounded mask of the right size.
- [x] Circle, oval, arch masks and all frames are unchanged; no engine/ratio change.

## Edge cases

- Radius larger than half the shorter side is clamped so the shape stays valid (a full pill, not an
  overflow).
- `maskRadius` absent while `mask === "rounded"`: use `DEFAULT_ROUNDED_SIZE`.
- A non-rounded mask ignores `maskRadius` entirely.
- Picker preview button (square): the rounded preview uses the default size at the button's own box.

## Architecture (flow + files)

`Photo.maskRadius` (types) -> `setPhotoMaskRadius` (store) -> renderers pass `{ w, h, radius }` to
`maskClipValue` (masks.ts), which returns `inset(0 round Rpx)` with `R` a constant circular radius.
Files: `types.ts`, `lib/masks.ts` (+ test), `store.ts`, `lib/project.ts` (migration), `PageCard.tsx`
(single rounded + size sub-control), `CroppedImg.tsx`, `Thumb.tsx`, `FramedPhoto.tsx`,
`BookPreview.tsx`/`PreviewPaper.tsx` (thread `maskRadius`), `lib/i18n.ts`. No engine change.

## Invariant

The layout engine is untouched (`computeLayout` / `photoLayoutRatio` unchanged), so no photo is
resized non-proportionally. The mask is the existing opt-in clip (spec 018); this spec only changes
the rounded mask's geometry (constant vs aspect-scaled radius) and how its size is chosen.
