# 008 - Book sizes + spine - Implementation plan

Order: types -> pure module -> tests -> project -> store -> components. No engine
change. This is phase 1 of print work (spec 009 = the PDF export).

## Steps

1. **Types** - `src/types.ts`: add `interface Spine { title: string }`. Leave
   `PageFormat` / `PAGE_ASPECT` in place (legacy shape the migration reads).

2. **Pure module** - `src/lib/book-sizes.ts` (new): `BookSizeId`, `BookSize`,
   `BOOK_SIZES` (5 Blurb sizes with mm + orientation), `ratioOf`, `BLEED_MM`,
   `SAFE_MM`, `PRINT_DPI`, `DEFAULT_BOOK_SIZE`, `bookSizeOrDefault`,
   `bookSizeForLegacyFormat`.

3. **Tests** - `src/lib/book-sizes.test.ts` (new): catalog well-formed (5 unique ids,
   positive dims), `ratioOf` (square 1.0, portrait 0.8, landscape 1.25), coercion,
   legacy-format mapping.

4. **Project** - `src/lib/project.ts`: `ProjectDoc` / `ProjectState` gain `bookSize`
   and `spine`, drop `format`. `newProjectDoc` defaults; `serializeProject` /
   `duplicateDoc` carry both; add a migration read `bookSize ?? bookSizeForLegacyFormat
   (doc.format)` and `spine ?? { title: "" }` (exposed as a helper used by the store on
   open). Add `effectiveSpineTitle(spine, frontCover)`. Extend `project.test.ts`.

5. **Store** - `src/store.ts`: state `bookSize` + `spine` (defaults), actions
   `setBookSize` (replaces `setFormat`) and `setSpineTitle`; `flushSave` slice,
   `createProject`, `openProject` (migrate legacy), delete-last reset. Extend
   `store.test.ts` (setBookSize only that field, setSpineTitle, legacy migration,
   effectiveSpineTitle).

6. **Components** - swap `PAGE_ASPECT[format]` -> `ratioOf(bookSizeOrDefault(bookSize))`
   in `Paper.tsx`, `CoverCard.tsx`, and `Thumb.tsx` (prop becomes `bookSize`, passed by
   `PageRail`). `TopBar.tsx`: replace the Format button group with a `SizeMenu` dropdown
   (5 sizes + cm). New `SpineCard.tsx`: title input + vertical spine preview using
   `effectiveSpineTitle`; wire into `App.tsx` near the front cover.

7. **Docs**: `docs/architecture.md` (data-model: bookSize replaces format + spine + the
   print constants for phase 2), `docs/overview.md`, `README.md`, and note phase 2.

## Test Plan

| Module     | Scenario                                              | Expected                                          |
| ---------- | ---------------------------------------------------- | ------------------------------------------------- |
| book-sizes | catalog: 5 unique ids, positive mm                   | well-formed                                       |
| book-sizes | `ratioOf` square / portrait / landscape              | 1.0 / 0.8 / 1.25                                  |
| book-sizes | `bookSizeOrDefault` unknown / missing                | default size                                      |
| book-sizes | `bookSizeForLegacyFormat` square/portrait/landscape  | 7x7 / 8x10 / 10x8 ids                             |
| project    | `newProjectDoc` defaults                             | bookSize = default, spine = { title: "" }         |
| project    | serialize / duplicate carry bookSize + spine         | round-trip keeps both                             |
| project    | migrate a legacy doc (format, no bookSize/spine)     | mapped bookSize, empty spine                       |
| project    | `effectiveSpineTitle`                                | spine title, else front cover title, else ""      |
| store      | `setBookSize` changes only bookSize                  | spine + others unchanged                          |
| store      | `setSpineTitle` changes only the spine               | bookSize unchanged                                |
| store      | open a legacy `format` doc                           | bookSize migrated, spine default, no throw        |
| layout     | (regression) engine untouched                        | existing ratio + fit tests stay green             |

Note: `SizeMenu` / `SpineCard` are presentational -> verified in Phase 5.

## Verify in app (Phase 5)

- `npm run build && npm run preview`, Load an example.
- Switch book size Portrait 8x10 -> Landscape 10x8: the page and cover previews change
  ratio; photos re-fit, never cropped (portrait stays portrait, panorama intact).
- Type a spine title; the vertical spine preview updates. Clear it; it falls back to
  the cover title. Reload: size + spine persist.
