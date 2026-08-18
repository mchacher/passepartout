# 006 - Text styles - Implementation plan

Order: types -> pure module -> tests -> project/store -> CSS -> components ->
apply hook + menu.

## Steps

1. **Types** - `src/types.ts`: add `subtitle: string` to `AlbumPage`.

2. **Pure module** - `src/lib/text-sizes.ts`: five-role `TextRole`, add `xl` to
   `TextSizeLevel`, `SIZE_SCALE` (0.85/1/1.2/1.45), `TEXT_ROLES` (5 display names),
   `TEXT_SIZE_LEVELS` (+XL), `DEFAULT_TEXT_SIZES` (5x md), `textSizesOrDefault`,
   `textScaleVars` -> five `--*-scale` vars.

3. **Tests** - `src/lib/text-sizes.test.ts`: rewrite for five roles + four levels
   (catalogs, md===1, xl>lg, coercion missing/partial/unknown/old-005-keys, vars).

4. **Store + project**:
   - `src/store.ts` `newPage()` sets `subtitle: ""`; add `setPageSubtitle`;
     `openProject` normalizes `subtitle: pg.subtitle ?? ""` alongside the existing
     photoIds filter. `AlbumState` gets `setPageSubtitle`. `textSizes` plumbing from
     005 stays (only the role set changed).
   - `src/lib/project.ts` unchanged in shape (pages carry `subtitle` automatically);
     verify serialize/duplicate keep it.
   - Update `src/lib/project.test.ts` and `src/store.test.ts` to the new role names +
     `subtitle` (page-subtitle round-trip, setPageSubtitle single-page, legacy page
     normalized to "").

5. **CSS** - `src/index.css`: five `--*-scale` vars default `1`.

6. **Components**:
   - `CoverCard.tsx`: title `var(--cover-title-scale)`, subtitle `var(--cover-subtitle-scale)`.
   - `Paper.tsx`: page title `var(--page-title-scale)`; render page subtitle under the
     title with `clamp(10px,2.2cqw,14px) * var(--page-subtitle-scale)` in
     `--album-ink-soft`; grow the inner top padding when a subtitle shows; caption
     `var(--caption-scale)`.
   - `PageCard.tsx`: subtitle input under the title, wired to `setPageSubtitle`.

7. **Apply hook + menu**:
   - `useApplyTheme`: unchanged logic, now emits five vars via `textScaleVars`.
   - `ThemeMenu.tsx`: five rows, four levels (S/M/L/XL) each.

8. **Docs**: update `docs/architecture.md` (data-model: AlbumPage.subtitle + five
   roles/vars), `docs/overview.md`, `README.md`.

## Test Plan

| Module     | Scenario                                            | Expected                                          |
| ---------- | -------------------------------------------------- | ------------------------------------------------- |
| text-sizes | five roles, four levels, unique                     | roles/levels sets correct                         |
| text-sizes | `SIZE_SCALE` md===1, xl>lg                          | md 1, xl 1.45 > lg 1.2                             |
| text-sizes | coercion: missing / partial / unknown / 005 keys    | every new role -> valid level, md fallback        |
| text-sizes | `textScaleVars(defaults)`                          | all five vars === "1"                             |
| text-sizes | `textScaleVars` with xl                            | var === String(SIZE_SCALE.xl)                     |
| types/store| `newPage` has subtitle ""                          | empty subtitle                                    |
| store      | `setPageSubtitle` changes only that page            | other pages untouched                             |
| store      | `setTextSize` changes only its role (5-role)        | other roles unchanged                             |
| store      | open legacy page missing subtitle                  | subtitle normalized to ""                          |
| store      | open legacy doc with 005 size keys                 | textSizes all md, no throw                         |
| project    | serialize/duplicate carry page subtitle + textSizes | round-trip keeps both                             |
| layout     | (regression) engine untouched                       | existing ratio + fit tests stay green             |

## Verify in app (Phase 5)

- `npm run build && npm run preview`, Load an example.
- Type a page subtitle; it renders under the title. Set Cover title = XL, Page title =
  S, Page subtitle = L, Caption = XL: each role scales independently, covers vs pages
  distinct, no photo moves or resizes. Reload: sizes + subtitle persist. Confirm a
  portrait stays portrait and a panorama stays intact.
