# Plan 020 — Decorative photo rotation

## Implementation steps

1. **Types** — `src/types.ts`: add `Photo.rotation?: number` (degrees; absent = 0).
2. **Pure lib** — `src/lib/rotation.ts`: `ROTATION_MAX = 30`, `ROTATION_STEPS = [5, 10]`,
   `clampRotation(deg: number): number` (clamp to `[-ROTATION_MAX, ROTATION_MAX]`; a
   non-finite value -> 0).
3. **Lib tests** — `src/lib/rotation.test.ts` per the Test Plan.
4. **Store** — `src/store.ts`: `setPhotoRotation(photoId, deg)` -> `clampRotation`, stored as
   `undefined` when 0 (so an un-tilted photo carries no field).
5. **Components**:
   - `CroppedImg.tsx` / `FramedPhoto.tsx`: add `rotation?: number`; when non-zero apply
     `transform: rotate(<deg>deg)` on the root (default transform-origin center).
   - `Paper.tsx` (cell + edit cell) and `PreviewPaper.tsx` (page leaf): thread
     `rotation={photo.rotation}` into `CroppedImg` / `FramedPhoto`. Add a `rotation` term to
     Paper's layout `frameKey` (so a memoized cell refreshes when it changes).
   - `PageCard.tsx`: a "Tilt" popover in the Edit-layout toolbar with buttons -10 / -5 /
     +5 / +10 and the current angle (click the angle to reset to 0), calling `setPhotoRotation`.
6. **Print** — `src/lib/pdf-export.ts`: a helper to rotate a drawn primitive about a center
   point (translate the anchor by the rotation about the box center, pass `rotate`), applied
   to `drawPhoto` (the image) and `drawFramedPhoto` (mat rect + inset image + note), so a
   framed unit rotates as one. Thread `rotation` through `ExportPageLike.items` and `ExportPanel`.

## Test Plan

| Module   | Scenario                                          | Expected                                    |
| -------- | ------------------------------------------------- | ------------------------------------------- |
| rotation | `clampRotation` within range                      | unchanged (e.g. 10 -> 10, -25 -> -25)       |
| rotation | `clampRotation` beyond +/- MAX                    | clamped to +/- `ROTATION_MAX`               |
| rotation | `clampRotation(NaN)` / `Infinity`                 | 0                                           |
| store    | `setPhotoRotation` clamps and stores              | target photo's `rotation` set, others same  |
| store    | `setPhotoRotation(0)`                             | `rotation` cleared (undefined)              |
| store    | `setPhotoRotation` out of range                   | clamped, never stored beyond the range      |

No engine change, so no new ratio/fit assertion in `computeLayout`: rotation is not one of
its inputs and does not change `effectiveRatio` / `photoLayoutRatio`. The invariant holds by
construction (a rotation preserves the whole photo and its ratio). The Phase 5 in-app pass
confirms the tilt keeps the photo whole and undistorted and that reset returns it to level.

## Tasks

- [x] 1 Types: `Photo.rotation?`
- [x] 2 Pure `rotation.ts`
- [x] 3 `rotation.test.ts`
- [x] 4 Store `setPhotoRotation` (+ store test)
- [x] 5 CroppedImg / FramedPhoto transform + render surfaces + PageCard Tilt control
- [x] 6 Print: rotate the photo / framed unit about center
- [x] 7 Validate + verify in-app + docs
