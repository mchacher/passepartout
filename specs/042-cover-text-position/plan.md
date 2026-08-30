# 042 - Implementation plan

## Steps

- [x] 1. **Types** (`src/types.ts`): `export type CoverTextPosition = "top" | "bottom"` and
      `Cover.textPosition?: CoverTextPosition`, documented as "absent = top, the default".
- [x] 2. **Pure layout** (`src/lib/cover-layout.ts`, new): the one source of truth for the
      mirror, in the caller's unit so print (points) and the editor (container-query
      percentages) read the same numbers.
      - `COVER_MARGIN`, `COVER_TOP_TITLE`, `COVER_TOP_SUBTITLE` move here from `print.ts`,
        which keeps re-exporting nothing new (they are internal).
      - `coverBand({ hasTitle, hasSubtitle })` - the band as a fraction of the face width.
      - `coverFaceAreas({ hasTitle, hasSubtitle, position, w, h })` - `{ photo: Rect, text:
        { top } }` relative to the face's top-left corner, both positions.
- [x] 3. **Pure tests** (`src/lib/cover-layout.test.ts`): the Test Plan below.
- [x] 4. **Project normalization** (`src/lib/project.ts`): `coverOrDefault` coerces
      `textPosition` (unknown or absent becomes `"top"`); `newCover` leaves it absent.
- [x] 5. **Print geometry** (`src/lib/print.ts`): `CoverFaceInput` and `InsideCoverPageInput`
      gain `textPosition`; `coverPanel` computes the photo area and the two text `y` values
      from `coverFaceAreas`. The `top` branch must produce exactly today's numbers.
- [x] 6. **Print tests** (`src/lib/print.test.ts`): the cover scenarios in the Test Plan.
- [x] 7. **Export** (`src/lib/pdf-export.ts`, `src/components/ExportPanel.tsx`):
      `ExportCoverFace` and the inside-cover `ExportPageLike` carry `textPosition` through to
      the geometry.
- [x] 8. **Store**: nothing. `updateCover(which, patch)` already takes a `Partial<Cover>` and
      coalesces per face and per field (spec 037).
- [x] 9. **Editor** (`src/components/CoverCard.tsx`): read the areas from `coverFaceAreas`,
      anchor the text overlay and the photo box accordingly, and add the two-state control to
      the card toolbar next to the whitespace slider.
- [x] 10. **Preview** (`src/components/PreviewPaper.tsx`, `src/components/BookPreview.tsx`):
      the same mirror on the cover leaf; `BookPreview` passes the face's position.
- [x] 11. **Copy** (`src/lib/i18n.ts`): EN + FR for the control and its two states.
- [x] 12. **Docs**: `docs/architecture.md` if the durable shape changed; `docs/overview.md`
      and the README feature list for a user-facing change; a release-notes line.

## Test Plan

| Module       | Scenario                                                          | Expected                                                              |
| ------------ | ----------------------------------------------------------------- | --------------------------------------------------------------------- |
| cover-layout | title + subtitle, `top`                                           | band 0.20w; photo area y = band, h = H - band - margin (today's numbers) |
| cover-layout | title + subtitle, `bottom`                                        | same band; photo area y = margin, h = H - margin - band                |
| cover-layout | title alone, both positions                                       | band 0.15w on both sides                                               |
| cover-layout | no text, both positions                                           | band = margin; the two areas are identical                             |
| cover-layout | any input                                                         | the two areas are exact mirrors: same height, offsets swapped          |
| cover-layout | text block, `bottom`                                              | the block's bottom sits `margin` above the face's bottom edge          |
| print        | cover panel, photo + text, `bottom`                               | photo box above the text; `w / h === photo.ratio` (RATIO)              |
| print        | cover panel, panorama, `bottom`                                   | contained in the area, no overflow on any edge (FIT)                   |
| print        | cover panel, `top`                                                | byte-for-byte the geometry produced before this feature (REGRESSION)   |
| print        | inside cover page, `bottom`                                       | the same mirror in the interior file's page geometry                   |
| print        | face with no text, `top` vs `bottom`                              | identical geometry                                                     |
| project      | doc saved before the feature                                      | every face loads with `textPosition` "top"                             |
| project      | stored `textPosition: "sideways"`                                 | coerced to "top", the rest of the face kept                            |
| project      | round-trip + duplicate                                            | each face keeps its own position                                       |

Engine note: `computeLayout` is NOT touched. The photo is still a single contained slot; only
the rectangle it is contained in moves. The ratio and fit assertions above are the proof.

## In-app verification (Phase 5)

Build, then drive the real app: put a photo and a title on the front cover, switch the control
to "under the photo", and check the editor, the book preview and an exported PDF agree. Confirm
visually that the photo is not cropped or distorted in either position, in light and dark.
