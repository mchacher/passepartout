# Plan 016 — Editor zoom

## Implementation steps

1. **Pure lib** — `src/lib/zoom.ts`:
   - Constants: `ZOOM_MIN = 0.5`, `ZOOM_MAX = 1`, `ZOOM_STEP = 0.05`, `ZOOM_DEFAULT = 1`
     (fit-to-width by default).
   - `clampZoom(z: number): number` — clamp to `[ZOOM_MIN, ZOOM_MAX]`; a non-finite
     value falls back to `ZOOM_DEFAULT`.
   - `zoomedWidthPx(availableWidthPx: number, z: number): number` —
     `Math.round(available * clampZoom(z))`; a non-positive / invalid available is 0.
2. **Lib tests** — `src/lib/zoom.test.ts` per the Test Plan below.
3. **View store** — `src/viewStore.ts`: add `zoom: number` (read from localStorage,
   clamped) and `setZoom(z)` (clamp, persist, set). Mirror the `showGrid` pattern; a
   storage failure is swallowed.
4. **Control** — `src/components/ZoomControl.tsx`: a floating pill (`fixed`, bottom-right,
   responsive right offset so it clears the 212px rail at `xl`), with a magnifier icon, a
   range input bound to `zoom` / `setZoom`, a percentage readout, and a "Fit" button that
   snaps to 100%. Tailwind semantic tokens only.
5. **App wiring** — `src/App.tsx`: measure the available width of the central column (a
   `ResizeObserver` on `main`, minus its `px-8` padding; `scrollbar-gutter: stable` keeps
   it steady), set the cards container width to `zoomedWidthPx(available, zoom)` with
   `maxWidth: 100%`, and mount `<ZoomControl>` when there are photos.

## Test Plan

| Module | Scenario                                        | Expected                                         |
| ------ | ----------------------------------------------- | ------------------------------------------------ |
| zoom   | `clampZoom` within range                        | returned unchanged (e.g. 0.7 -> 0.7)             |
| zoom   | `clampZoom` below min / above max               | clamped to `ZOOM_MIN` / `ZOOM_MAX`               |
| zoom   | `clampZoom(NaN)` / `Infinity`                   | falls back to `ZOOM_DEFAULT`                     |
| zoom   | `zoomedWidthPx(avail, 1)`                        | equals `avail` (fit)                             |
| zoom   | `zoomedWidthPx(avail, 0.5)`                      | half of `avail`                                  |
| zoom   | `zoomedWidthPx` clamps out-of-range, caps at fit | never exceeds `avail`                            |
| zoom   | `zoomedWidthPx` with invalid / non-positive avail | returns 0                                        |

No engine change, so no new ratio/fit assertions in the layout engine; the invariant is
preserved by construction (zoom only feeds a larger width into the unchanged engine).
The in-app pass (Phase 5) confirms photos stay contain-fit at maximum zoom.

## Tasks

- [x] 1 Pure lib `zoom.ts`
- [x] 2 Lib tests `zoom.test.ts`
- [x] 3 `viewStore` zoom + setZoom (persisted)
- [x] 4 `ZoomControl` component
- [x] 5 App wiring (container width + mount control)
- [x] 6 Validate + verify in-app + docs
