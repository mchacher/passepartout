# 009 - PDF export - Implementation plan

Order: dependency -> pure print geometry -> geometry tests -> impure PDF builder ->
export panel. No engine change. Phase 2 of print work (phase 1 = spec 008).

## Steps

1. **Dependency**: `npm i pdf-lib`. Confirm it bundles offline (Vite) and the build
   still passes.

2. **Pure geometry** - `src/lib/print.ts` (new, framework-free):
   - `mmToPt`, `inToPt`; `PT_PER_MM`.
   - `PAPERS` catalog (a few Blurb papers) with a per-page thickness (mm);
     `estimateSpineMm(interiorPageCount, paperId)` monotonic in page count.
   - `interiorPageGeometry(...)`: media box (trim + bleed), trim box, content box (trim
     inset by the page margin), region cells from `computeLayout`, title/subtitle
     placements + point sizes from trim width x text-size scale.
   - `coverWrapGeometry(size, spineWidthPt, ...)`: wrap media box, back/spine/front
     panels, spine vertical title placement.
   - `fontFor(fontThemeId)`: album font -> a `StandardFonts` name.

3. **Geometry tests** - `src/lib/print.test.ts` (new): media box = trim + 2*bleed;
   content box within trim; **every cell w/h === photo.ratio** (ratio preservation);
   cells within the content box (no overflow); cover wrap width = 2*trimW + spine +
   2*bleed; `estimateSpineMm` monotonic + override path.

4. **PDF builder** - `src/lib/pdf-export.ts` (new, impure, browser):
   - `buildInteriorPdf(project, imageFor)` / `buildCoverWrapPdf(project, spineWidthPt,
     imageFor)` -> `Uint8Array` via `pdf-lib`, consuming the pure geometry.
   - `imageFor(photoId)` resolves the photo's bytes; a canvas re-encodes each photo to a
     300 DPI sRGB JPEG at its box size; embed with `embedJpg`. Paper fill; vector text in
     album ink; set media/trim/bleed boxes.
   - A missing blob is skipped (whitespace kept).

5. **Export UI** - `src/components/ExportPanel.tsx` (new) + a top-bar Export button:
   interior page count, paper selector, estimated spine (mm) with editable override, an
   sRGB note, and Download cover / Download interior (object URL + `<a download>`, file
   names from the project name). Wire a helper to read photo blobs from
   `src/persistence.ts` (`getImage`) or the object URLs.

6. **Docs**: `docs/architecture.md` (the export module + "reuse the engine at print
   resolution" made real), `docs/overview.md`, `README.md`, tick the roadmap PDF item.

## Test Plan

| Module | Scenario                                                   | Expected                                             |
| ------ | --------------------------------------------------------- | ---------------------------------------------------- |
| print  | interior media box for a size                              | trim(pt) + 2*bleed on width and height               |
| print  | content box inside trim inside media box                   | strictly contained, inset by margin + bleed          |
| print  | page with mixed portrait + landscape                       | every cell w/h === photo.ratio (ratio preserved)     |
| print  | cells fit the content box                                  | no cell exceeds the content box (no overflow)        |
| print  | panorama wider than the page                               | scaled to fit, ratio intact, no clip                 |
| print  | cover wrap width                                           | 2*trimW + spineWidthPt + 2*bleed                     |
| print  | `estimateSpineMm` grows with page count                    | monotonic; more pages => wider spine                 |
| print  | `fontFor` maps each album font                             | a valid StandardFonts family                         |
| layout | (regression) engine untouched                              | existing ratio + fit tests stay green                |

Note: `pdf-export.ts` (pdf-lib + canvas) and `ExportPanel` are impure/presentational ->
verified in Phase 5 by exporting and opening the PDFs.

## Verify in app (Phase 5)

- `npm run build && npm run preview`, Load an example, pick a book size.
- Open Export: check the page count and spine estimate; override the spine; download
  both PDFs. Open them: confirm page size = trim + bleed, the cover wrap is back + spine
  + front with the vertical spine title, photos are sharp and uncropped (portrait stays
  portrait, panorama intact), and the paper bleeds to the edge. Confirm the layout
  matches the on-screen preview.
