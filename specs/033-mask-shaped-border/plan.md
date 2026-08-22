# Plan 033: Border follows the mask shape

## Implementation steps

1. **Component** `src/components/FramedPhoto.tsx`: for the non-square (Border) style, resolve
   `maskClipValue(mask)` once; apply it as `clipPath` on the outer mat `<div>`. When a mask clip is
   present, drop the `box-shadow` and use `filter: drop-shadow(0 2px 8px rgba(0,0,0,0.18))` (follows
   the clipped silhouette); otherwise keep the current `box-shadow`. Leave the Polaroid branch and
   the inner `CroppedImg` (which already applies the mask) untouched.

No engine, store, types, or catalog change. Masks stay screen-only; `pdf-export` is not touched.

## Test Plan

This is a pure rendering composition of two existing, already-tested pieces (`maskClipValue` from
spec 018/032 and the Border geometry from spec 019). There is no new pure logic to unit-test:
`maskClipValue` is already covered in `src/lib/masks.test.ts`, and the frame geometry
(`frameInner`, `frameLayoutRatio`) is unchanged. Per the project's testing approach (pure logic is
unit-tested; UI is verified by driving it), verification is in-app (Phase 5).

| Module      | Scenario                                              | Expected                                            |
| ----------- | ---------------------------------------------------- | --------------------------------------------------- |
| FramedPhoto | Border + circle mask, landscape photo (in-app)       | circular mat ring, uniform width, no distortion     |
| FramedPhoto | Border + circle mask, portrait photo (in-app)        | circular mat ring, uniform width                    |
| FramedPhoto | Border + oval / rounded / arch mask (in-app)         | mat ring of that shape                              |
| FramedPhoto | Border, no mask (in-app)                              | unchanged: rectangular mat + box-shadow             |
| FramedPhoto | Polaroid + mask (in-app)                             | unchanged Polaroid; window masked as before         |
| engine      | existing ratio + fit tests still pass                | no regression (engine untouched)                    |

## Notes

- No ratio test is added because the engine is not touched; the existing `layout.test.ts` ratio and
  fit assertions still run at Gate 4 and prove no regression.
- Keep the drop-shadow subtle and matched to the current box-shadow so unmasked and masked frames
  read consistently.
