# Plan 018 — Decorative photo masks

## Implementation steps

1. **Types** — `src/types.ts`: add `Photo.mask?: string` (mask id; absent = no mask).
2. **Pure catalog** — `src/lib/masks.ts`:
   - `export interface MaskShape { id: string; name: string; path: string }` where `path`
     is a normalized SVG path (objectBoundingBox, 0..1).
   - `export const MASKS: MaskShape[]` — starter set: `oval` (ellipse filling the box),
     `rounded` (rounded rectangle), `arch` (rectangle with a rounded top).
   - `maskById(id: string | undefined): MaskShape | undefined`; `isMask(id): boolean`.
3. **Catalog tests** — `src/lib/masks.test.ts` per the Test Plan.
4. **Store** — `src/store.ts`: `setPhotoMask(photoId, id: string | null)` — set `mask` when
   `id` is a known catalog id, clear it (undefined) for `null` or an unknown id; scheduleSave.
5. **Components**:
   - `src/components/MaskDefs.tsx` (new): a hidden `<svg>` with one
     `<clipPath id="pp-mask-<id>" clipPathUnits="objectBoundingBox"><path d=.../></clipPath>`
     per catalog entry. Mount once in `App.tsx`.
   - `src/components/CroppedImg.tsx`: add `mask?: string`; when set, apply
     `style={{ clipPath: `url(#pp-mask-${mask})` }}` on the frame.
   - `Paper.tsx`, `PreviewPaper.tsx`, `Thumb.tsx`: pass `photo.mask` into `CroppedImg`.
   - `PageCard.tsx`: a "Mask" popover button in the Edit-layout toolbar (None + catalog
     swatches), calling `setPhotoMask(sel.photoId, id | null)`.
6. **Print** — `src/lib/pdf-export.ts`: in `photoJpegBytes`, when a mask is given, clip the
   canvas to the mask path scaled to the pixel box (`Path2D` + `DOMMatrix(pxW,pxH)`), and
   encode PNG (`toBlob("image/png")`, `embedPng`) so the outside-shape area is transparent;
   thread the mask through `drawPhoto` and the page/cover assembly in `ExportPanel.tsx`.

## Test Plan

| Module | Scenario                                          | Expected                                             |
| ------ | ------------------------------------------------- | ---------------------------------------------------- |
| masks  | catalog integrity                                 | ids unique and non-empty, every `path` non-empty     |
| masks  | `maskById` a known id                             | returns that shape                                   |
| masks  | `maskById` unknown / undefined                    | returns undefined                                    |
| masks  | `isMask`                                           | true for a catalog id, false otherwise               |
| store  | `setPhotoMask` with a known id                    | `photo.mask` set to that id, others unchanged        |
| store  | `setPhotoMask(null)`                              | `photo.mask` cleared (undefined)                     |
| store  | `setPhotoMask` with an unknown id                 | `photo.mask` cleared (no invalid id persisted)       |

The layout engine is not touched, so there is no new ratio/fit assertion: a mask is not an
input to `computeLayout` and does not change `effectiveRatio`. The invariant holds by
construction (the mask only reshapes what is visible inside the already-computed box). The
in-app pass (Phase 5) confirms a masked photo keeps its ratio/size and that None restores
the rectangle.

## Tasks

- [x] 1 Types: `Photo.mask?`
- [x] 2 Pure `masks.ts` catalog
- [x] 3 `masks.test.ts`
- [x] 4 Store `setPhotoMask` (+ store test)
- [x] 5 MaskDefs + CroppedImg + render surfaces + PageCard picker
- [x] 6 Print: clip + PNG for masked photos
- [x] 7 Validate + verify in-app + docs
