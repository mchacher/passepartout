# 010 - Larger photos - Implementation plan

Order: engine + tests, then the margins in Paper and print (kept in sync), then the
default level.

## Steps

1. **Engine** - `src/lib/layout.ts`:
   - `fill`: `0.5 + 0.5 * (density/100)` -> `0.6 + 0.4 * (density/100)`.
   - `gap`: `Math.max(6, Math.min(contentW, contentH) * 0.03)` ->
     `Math.max(4, Math.min(contentW, contentH) * 0.02)`.

2. **Engine tests** - `src/lib/layout.test.ts`: add
   - fill floor: a single photo at density 0 fills ~0.6 of its region (was ~0.5),
     ratio intact.
   - full fill: at density 100 the photo fills its region's constraining dimension.
   - a smaller gap than the old formula for a two-region split (regions sit closer),
     still no overlap.
   Existing ratio + no-overflow + monotonic tests must stay green.

3. **Page margin** - `src/components/Paper.tsx`: content padding `7%` -> `5%`;
   `paddingTop` `13%`/`16%` -> `11%`/`14%`. `src/lib/print.ts`: `MARGIN 0.07 -> 0.05`,
   `TOP_TITLE 0.13 -> 0.11`, `TOP_SUBTITLE 0.16 -> 0.14` (kept identical so preview ==
   print).

4. **Default level (maximize)** - `src/types.ts`: `DEFAULT_WHITESPACE 4 -> 1`, so a fresh
   page/cover fills its regions to the contain-fit by default. Check `store.test.ts` for
   any test asserting the old default and update it.

5. **Docs**: a line in `docs/overview.md` (whitespace levels) and `roadmap.md` (mark the
   item done). No architecture change.

## Test Plan

| Module | Scenario                                             | Expected                                                |
| ------ | --------------------------------------------------- | ------------------------------------------------------- |
| layout | single square photo at density 0 (airiest)          | boxH ~= 0.6 * region (bigger than the old 0.5), ratio 1 |
| layout | single square photo at density 100 (tightest)       | boxH == region size (fill 1.0), ratio 1                 |
| layout | ratio preserved across densities/templates          | w/h === ratio (existing, must stay)                     |
| layout | no photo overflows its region at any density        | box <= region (existing, must stay)                     |
| layout | two-row split gap is smaller than the old 3% formula | inter-region gap shrinks, regions do not overlap        |
| layout | bigger photo at higher density                      | monotonic (existing, must stay)                         |

## Verify in app (Phase 5)

- `npm run build && npm run preview`, Load an example.
- Compare a page before/after: photos fill more of the page at the same whitespace
  level; a portrait stays portrait, a panorama stays intact (no crop). Check the rail
  thumbnails and an exported interior PDF get the same larger photos. Nudge the
  whitespace slider to confirm the range still breathes at the top end.
