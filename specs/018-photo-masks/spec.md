# Spec 018 — Decorative photo masks

## Context

The photographer wants to give a photo a decorative shape (oval, arch, rounded, ...)
instead of the default rectangle. This is a clipping feature, so it lives under the same
opt-in exception the crop tool (spec 015) and full-page Fill (spec 012) already carry:
**no mask is the default; a mask is an explicit, per-photo choice.** It must be an
evolutive feature: the shapes live in one catalog that can be enriched by adding an entry,
never touched by the layout engine.

## The one rule (and its explicit exception)

The founding rule is "a photo's aspect ratio is never changed and a photo is never
clipped." A mask clips (it hides the pixels outside the shape). Like the crop tool, this
is an **explicit, per-photo opt-in**, not an automatic behaviour: an un-masked photo is
still shown whole and contain-fit. A mask never changes the photo's aspect ratio or its
size in the layout; it only reshapes what is visible **inside the box the engine already
chose**. The engine is not touched, so its ratio/fit invariant holds by construction.

## Goals

- A catalog of decorative mask shapes, enrichable by adding one entry (id + name +
  normalized path). Starter set: Oval, Rounded, Arch (plus None).
- A photo can opt in to one mask. The mask **follows the photo's box**: it scales to the
  photo's contain-fit rectangle (a "circle" becomes an oval on a non-square photo), so the
  photo keeps its ratio and size and only the pixels outside the shape are hidden.
- The mask shows everywhere the photo is placed (editor page, book preview, page rail) and
  in the printed PDF (WYSIWYG). The Library catalog keeps showing the raw photo.
- A mask composes with an existing crop (spec 015): the crop selects the region, the mask
  reshapes it.

## Non-goals

- No mask on the cover faces or on a full-page photo in this spec (like the crop tool,
  masks are offered in the page "Edit layout" flow only; covers can follow later).
- No per-mask parameters (corner radius sliders, rotation, ...); a mask is a fixed shape.
  Variants are added as new catalog entries instead.
- No change to the layout engine, the whitespace model, or `effectiveRatio`.

## Data model

- `Photo.mask?: string` — the id of the chosen mask, or absent for no mask (the default).
  An unknown id is treated as no mask.
- New pure catalog `src/lib/masks.ts`:
  - `MaskShape = { id: string; name: string; path: string }` where `path` is an SVG path
    in normalized `objectBoundingBox` units (all coordinates in 0..1), so it scales to any
    box. `MASKS: MaskShape[]` is the catalog; `maskById(id)` looks one up; `isMask(id)`
    validates. No mask is represented by an absent id (there is no "none" catalog entry;
    the picker offers None separately).

## Architecture

Flow: `store.setPhotoMask(photoId, id|null)` writes `Photo.mask` → every placement render
(`Paper`, `PreviewPaper`, `Thumb`) passes the mask to `CroppedImg`, which applies
`clip-path: url(#pp-mask-<id>)` on its frame → a shared `<MaskDefs>` (mounted once in
`App`) provides the `<clipPath clipPathUnits="objectBoundingBox">` for every catalog entry
→ the PDF painter clips the canvas to the same normalized path (scaled to the box) before
drawing, and encodes a masked photo as PNG (alpha) instead of JPEG.

Files changed:

- `src/types.ts`: `Photo.mask?: string`.
- `src/lib/masks.ts` (new, pure) + `src/lib/masks.test.ts`.
- `src/store.ts`: `setPhotoMask(photoId, id | null)` (validates against the catalog).
- `src/components/MaskDefs.tsx` (new): the shared hidden SVG clipPath defs; mounted in `App`.
- `src/components/CroppedImg.tsx`: a `mask?` prop applying the clip-path on the frame.
- `src/components/Paper.tsx`, `PreviewPaper.tsx`, `Thumb.tsx`: thread `photo.mask` into `CroppedImg`.
- `src/components/PageCard.tsx`: a "Mask" control in the Edit-layout toolbar (None + catalog).
- `src/lib/pdf-export.ts`: clip the canvas to the mask path, encode masked photos as PNG.

## Requirements

1. A mask catalog exists in one file; adding a shape is one new entry.
2. In "Edit layout", the selected photo can be given a mask or set back to None.
3. The mask follows the photo's box (scales to it); the photo's ratio and size are
   unchanged, only the outside-shape pixels are hidden.
4. The mask renders identically in the editor, the book preview, the page rail, and the
   exported PDF.
5. An un-masked photo is unchanged (rectangle, contain-fit). No photo is masked by default.
6. A mask composes with a crop.

## Acceptance criteria

- [x] The Edit-layout toolbar offers a Mask control listing None + the catalog shapes.
- [x] Applying "Oval" to a photo shows it as an oval that fills its box; the photo is not
      distorted (its content keeps its ratio) and its layout size is unchanged.
- [x] Setting the mask back to None restores the plain rectangle.
- [x] The same masked photo shows the mask in the page rail and the book preview.
- [x] The exported interior PDF shows the mask (verified by re-importing / inspection), with
      the area outside the shape transparent.
- [x] A masked photo that also has a crop shows the crop region reshaped by the mask.
- [x] Adding a new entry to `MASKS` makes it appear in the picker with no other change.

## Edge cases

- Unknown / stale mask id (catalog entry removed): treated as no mask (rectangle).
- Mask on a panorama or a portrait: the shape scales to that box (a wide oval, a tall
  oval); nothing is distorted.
- Mask + overlap (spec 013): the transparent outside-shape area lets a photo below show
  through (PNG alpha in print, clip-path on screen).
- Empty page / no photo selected: the Mask control is inert (nothing to mask).
