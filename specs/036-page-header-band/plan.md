# 036 - Implementation plan

## Steps (all done)

1. **Pure lib** - `src/lib/page-header.ts`
   - Constants: `HEADER_TOP = 0.054` (of height), `F_PAGE_TITLE = 0.031`,
     `F_PAGE_SUBTITLE = 0.022` (of width), `LINE = 1.15`, `GAP_FRAC = 0.3`,
     `CLEARANCE = 0.025` (of width).
   - `headerGeometry({ titleSize, subtitleSize, pageW, pageH })` works in ONE absolute unit
     (px on screen, points in the PDF) and returns the band, the gap, the two glyph tops and
     the clearance. Shipped as a single function rather than the fractions-plus-combiner pair
     first sketched here: every caller wants an absolute length anyway.
   - `headerFontSize` / `headerFontCss` declare the text size once, for the JS and the CSS.
   - No DOM, no React, no import from components.

2. **Lib tests** - `src/lib/page-header.test.ts` (see Test Plan).

3. **Print** - `src/lib/print.ts`
   - Drop `TOP_TITLE` / `TOP_SUBTITLE`; take the top margin from `headerBandLength`.
   - Place the subtitle with the shared offset instead of `title.sizePt * 1.2`.
   - Keep `F_PAGE_TITLE` / `F_PAGE_SUBTITLE` as the single source, re-exported from or moved
     into the new module so the fractions are declared once.

4. **Editor** - `src/components/Paper.tsx`
   - Compute the padding from the measured page box instead of the `12.5%` / `10%` literal:
     `measure()` reads `clientWidth` / `clientHeight` and derives side padding, top padding
     (the band) and the content box in one pass, dropping the `getComputedStyle` round trip
     (which would read a stale padding once the padding itself is state-derived).
   - Set the explicit line-height on the two header lines so the DOM matches `LINE`.
   - Replace `mt-[1%]` with the computed subtitle offset.
   - Drop the readability clamp on the two font sizes (R6) so the on-screen text is the same
     fraction of the page as the printed text.

5. **Book preview** - `src/components/PreviewPaper.tsx`
   - Same band and same subtitle offset, from the page size it already knows.

6. **Check the PDF painter** - `src/lib/pdf-export.ts`: confirm whether `TextPlace.y` is a
   baseline or a top edge, and make the offset consistent with that.

## Test Plan

| Module      | Scenario                                                        | Expected                                                              |
| ----------- | --------------------------------------------------------------- | --------------------------------------------------------------------- |
| page-header | title + subtitle at md                                            | band ~0.147 of width on a square page; documented reference value      |
| page-header | clearance at sm / md / lg / xl                                    | identical value at all four levels (R2)                                |
| page-header | clearance, title alone vs title + subtitle                        | identical value (R2)                                                   |
| page-header | band grows monotonically sm < md < lg < xl                        | strictly increasing                                                    |
| page-header | title-to-subtitle gap at md                                       | strictly smaller than 0.0086 of width, today's `mt-[1%]` (R3)          |
| page-header | gap scales with the subtitle level                                | proportional to subtitleScale                                          |
| page-header | no title, no subtitle                                             | band === the plain 5% margin                                           |
| page-header | subtitle without a title                                          | no gap; subtitle occupies the title's line; clearance unchanged        |
| page-header | non-square page (8x10 and 13x11)                                  | top part scales with height, text part with width                      |
| print       | interiorPageGeometry, title + subtitle                            | contentBox.y === trimBox.y + headerBandLength(...)                     |
| print       | interiorPageGeometry at sm vs xl                                  | contentBox.y grows with the level; contentBox stays inside the trim    |
| print       | interiorPageGeometry, no text                                     | contentBox.y === trimBox.y + 0.05 * trimW, unchanged from today        |
| print       | subtitle placement                                                | subtitle.y === title.y + the shared offset, not the old 1.2 factor     |
| print       | photo boxes at every level                                        | every photo w/h === its ratio (invariant), all inside the content box  |

The engine itself is not modified, so `layout.test.ts` is untouched; the ratio and fit
assertions above are made on the print geometry, which is what the band actually resizes.

## Verification (Phase 5)

- Drive the editor at sm / md / lg / xl with a title and a subtitle: the clearance under the
  subtitle must not change, and nothing must overlap the photos.
- Compare a page in the editor and in the book preview at the same level.
- Export a real PDF and check the header band against the on-screen page.
- Light and dark, since the header styling is touched.
