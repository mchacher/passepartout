# Plan 016 — Editor zoom

## Implementation steps

1. **Pure lib** — `src/lib/zoom.ts`:
   - Constants: `ZOOM_MIN = 0.8`, `ZOOM_MAX = 1.6`, `ZOOM_STEP = 0.1`,
     `ZOOM_DEFAULT = 1`, `BASE_WIDTH_PX = 620`.
   - `clampZoom(z: number): number` — clamp to `[ZOOM_MIN, ZOOM_MAX]`; a non-finite
     value falls back to `ZOOM_DEFAULT`.
   - `zoomWidthPx(z: number): number` — `Math.round(BASE_WIDTH_PX * clampZoom(z))`.
2. **Lib tests** — `src/lib/zoom.test.ts` per the Test Plan below.
3. **View store** — `src/viewStore.ts`: add `zoom: number` (read from localStorage,
   clamped) and `setZoom(z)` (clamp, persist, set). Mirror the `showGrid` pattern; a
   storage failure is swallowed.
4. **Control** — `src/components/ZoomControl.tsx`: a floating pill (`fixed`, bottom-right,
   responsive right offset so it clears the 212px rail at `xl`), with a magnifier icon, a
   range input bound to `zoom` / `setZoom`, and a percentage readout. Tailwind semantic
   tokens only.
5. **App wiring** — `src/App.tsx`: set the central cards container width to
   `zoomWidthPx(zoom)` with `maxWidth: 100%` (so it never overflows), and mount
   `<ZoomControl>` when there are photos.

## Test Plan

| Module | Scenario                                        | Expected                                         |
| ------ | ----------------------------------------------- | ------------------------------------------------ |
| zoom   | `clampZoom` within range                        | returned unchanged (e.g. 1.2 -> 1.2)             |
| zoom   | `clampZoom` below min / above max               | clamped to `ZOOM_MIN` / `ZOOM_MAX`               |
| zoom   | `clampZoom(NaN)` / `Infinity`                   | falls back to `ZOOM_DEFAULT`                     |
| zoom   | `zoomWidthPx(1)`                                 | `BASE_WIDTH_PX` (620)                            |
| zoom   | `zoomWidthPx(ZOOM_MAX)` > `zoomWidthPx(1)`       | strictly larger (monotonic)                      |
| zoom   | `zoomWidthPx` clamps an out-of-range input first | equals `zoomWidthPx(ZOOM_MAX/MIN)`               |

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
