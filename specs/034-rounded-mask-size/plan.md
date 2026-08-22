# Plan 034: Single rounded mask with a size sub-control and a constant radius

## Implementation steps (in order)

1. **Types** `src/types.ts`: add `maskRadius?: number` to `Photo` (rounded-corner radius as a
   fraction of the shorter box side; only meaningful with `mask === "rounded"`).
2. **Catalog** `src/lib/masks.ts`:
   - Replace the three rounded entries with one `{ id: "rounded", name: "Rounded" }`.
   - Add `ROUNDED_SIZES = [{id,label,value}]` (3 sizes, value = fraction of the shorter side),
     `DEFAULT_ROUNDED_SIZE`, `roundedRadiusOf(v)` (coerce + clamp to <= 0.5).
   - Extend `maskClipValue(id, ctx?)` with `ctx = { w?, h?, radius? }`: rounded ->
     `inset(0 round ${roundedRadiusOf(radius) * Math.min(w, h)}px)`; circle -> `circle(closest-side)`;
     others -> `url(#pp-mask-<id>)`.
3. **Catalog test** `src/lib/masks.test.ts`: update for the single rounded id, `ROUNDED_SIZES`,
   `roundedRadiusOf`, and the format-independent rounded clip (see Test Plan).
4. **Store** `src/store.ts`: `setPhotoMaskRadius(photoId, value)` (coerced), mirroring
   `setPhotoFrameWidth`.
5. **Migration** `src/lib/project.ts`: on hydrate, map a photo with `mask === "rounded-sm" |
   "rounded-lg"` to `mask: "rounded"` + the matching `maskRadius`.
6. **Renderers**: thread `maskRadius` + box size into `maskClipValue`:
   - `CroppedImg.tsx` (add `maskRadius?` prop; it already has `w`/`h`),
   - `Thumb.tsx` (add `maskRadius` to `ThumbPhoto`; box is the percent cell - use its px? Thumb lays
     out in a nominal 100-unit box, so pass the cell w/h it already computes),
   - `FramedPhoto.tsx` (mat: its `w`/`h`; inner photo via `CroppedImg`),
   - `PreviewPaper.tsx` / `BookPreview.tsx` (`PreviewPhoto` gains `maskRadius`),
   - `PageCard.tsx` picker preview (rounded uses the default size at the 36px button box).
7. **UI** `PageCard.tsx`: one "Rounded" shape button; when the selected photo's mask is `rounded`,
   a size sub-control (3 buttons) under the shapes, calling `setPhotoMaskRadius`.
8. **i18n** `src/lib/i18n.ts`: remove `mask.rounded-sm` / `mask.rounded-lg`; add `roundedSize.<id>`
   (EN + FR). Keep en/fr parity and the catalog-drift test green (it iterates the new `MASKS`).

## Test Plan

| Module | Scenario | Expected |
| ------ | -------- | -------- |
| masks  | catalog has one `rounded`, no `rounded-sm`/`rounded-lg`     | ids present/absent as stated |
| masks  | `ROUNDED_SIZES` has 3 ascending values; `roundedRadiusOf` clamps | coerced within (0, 0.5] |
| masks  | `maskClipValue("rounded", {w:200,h:300,radius:0.1})`       | `"inset(0 round 20px)"` (min=200) |
| masks  | `maskClipValue("rounded", {w:300,h:200,radius:0.1})`       | `"inset(0 round 20px)"` - same as portrait (format-independent) |
| masks  | `maskClipValue("rounded", {w,h})` with no radius           | uses `DEFAULT_ROUNDED_SIZE` |
| masks  | `maskClipValue("circle", ...)` / `("oval", ...)`           | `circle(closest-side)` / `url(#pp-mask-oval)` (unchanged) |
| i18n   | en/fr key parity; every `MASKS` id has en(name)=lib + fr   | pass (drift test) |
| project| hydrate a photo with `mask:"rounded-lg"`                   | becomes `mask:"rounded"` + `maskRadius` = lg value |

UI (single selector + sub-control, live radius change, constant/circular corners on portrait vs
landscape, border ring rounded) is verified in-app in Phase 5 (no React component tests).

## Notes

- No engine change, so the existing `layout.test.ts` ratio/fit assertions prove no regression.
- The border-ring corners (spec 033) use each box's own constant radius; the ring stays visually
  even for the gentle default sizes. A perfectly uniform corner ring (inner radius = outer minus
  border) is a possible later refinement, out of scope here.
