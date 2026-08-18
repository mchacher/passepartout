# 009 - Print-ready PDF export (Blurb)

## Context

Spec 008 grounded every page in a real Blurb trim size and added the spine. This spec
delivers the actual deliverable: a **print-ready PDF export** a photographer can upload
to Blurb's PDF-to-Book. It builds directly on the book size, the spine, the covers, and
the same pure layout engine, so the printed book matches the on-screen preview and no
photo is ever cropped. This is **phase 2 of the print work** (phase 1 = spec 008).

Research (Blurb PDF-to-Book): individual pages (not spreads); full bleed **0.125 in**
past trim; safe margin **0.25 in**; **300 PPI** images; **sRGB** accepted (CMYK needs
desktop ICC tooling, out of scope in a browser); the cover is a **wrap** (back + spine +
front) submitted separately from the interior pages; spine width comes from Blurb's spec
tool (page count + paper), so we estimate and let the user override.

## Goals

- A pure `src/lib/print.ts` that turns a project into **print geometry** in PDF points:
  per interior page and per cover-wrap panel, the media box (trim + bleed), the trim
  box, the content regions (via `computeLayout` on the margin-inset content box), and
  the text placements + point sizes. Pure and unit-tested, exactly like the engine.
- A **PDF builder** (`src/lib/pdf-export.ts`, impure, browser-only) that paints that
  geometry with `pdf-lib`: the album paper bleeds to the media-box edge, each photo is
  re-encoded to an sRGB JPEG at its exact box size (300 DPI, contain-fit, never cropped)
  and embedded, and titles/subtitles/captions/spine are drawn as vector text.
- Two files, matching Blurb's split:
  - **Cover wrap** (1 page): back cover (left) + spine (middle, the effective spine
    title, vertical) + front cover (right), with bleed around the whole wrap.
  - **Interior** (N pages, one each): inside front cover, every content page in order,
    inside back cover.
- An **Export panel**: shows the interior page count, an **estimated spine width (mm)**
  that the user can override (paste Blurb's exact value), a paper choice that feeds the
  estimate, and buttons to download the cover-wrap and interior PDFs.

## Non-goals

- No CMYK / ICC. sRGB only (Blurb accepts it). Documented in the panel.
- No exact embedding of the album's system fonts. Print maps each album font to the
  closest standard PDF font (serif -> Times, sans/humanist/rounded -> Helvetica,
  typewriter -> Courier). Vector, crisp; a future spec can bundle the real fonts.
- No layout-engine change. `computeLayout` is reused verbatim.
- No direct upload to Blurb (download files; the user uploads them).

## The one rule

Central here. Each photo is placed at its `computeLayout` contain-fit box, and the
re-encoded JPEG canvas is that box's exact pixel size at the photo's own ratio, so
`w/h === ratio` at 300 DPI: never stretched, never cropped. The paper (not a photo)
bleeds to the edge. `src/lib/layout.ts` is not modified. Print geometry tests assert
ratio preservation and containment, like the engine tests.

## Requirements

### Dependency

- Add `pdf-lib` (pure JS, runs in the browser, no network) as a runtime dependency. It
  builds the PDF, embeds JPEG images, draws vector text and standard fonts, and sets the
  media/trim/bleed boxes. Bundled by Vite; the app stays fully offline.

### Print geometry (`src/lib/print.ts`, pure)

- Units: PDF points (1 pt = 1/72 in); `mmToPt`, `inToPt` helpers. Trim = the book
  size (`widthMm`/`heightMm` -> pt). Bleed = `BLEED_MM`, safe margin = `SAFE_MM`
  (from `book-sizes.ts`).
- `interiorPageGeometry(page, size, ...)`: media box = trim + bleed on every side;
  trim box inset by the bleed; content box = trim inset by the page margin (the same
  ~7% the on-screen `Paper` uses, so preview == print); `computeLayout` over the content
  box gives each photo's region + contain-fit box; title/subtitle placements + point
  sizes derived from the trim width and the project's text-size scales (matching the
  on-screen cqw proportions).
- `coverWrapGeometry(size, spineWidthPt, ...)`: wrap media box width =
  `2*trimW + spineWidthPt + 2*bleed`, height = `trimH + 2*bleed`; three panels (back,
  spine, front) with their own content boxes; the spine panel carries the vertical
  effective spine title.
- `estimateSpineMm(interiorPageCount, paper)`: a monotonic estimate from the sheet
  count and a per-paper thickness constant; `PAPERS` catalog (a few Blurb paper types).
  The UI can override the result.

### PDF builder (`src/lib/pdf-export.ts`, impure)

- `buildInteriorPdf(project, photoBytesFor)` and `buildCoverWrapPdf(project,
  spineWidthPt, photoBytesFor)` return `Uint8Array` (the PDF). They consume the pure
  geometry and use `pdf-lib`.
- Photos: for each box, draw the loaded image into a canvas sized to the box in pixels
  at 300 DPI, `toBlob("image/jpeg")` (sRGB), embed. Handles any browser-decodable source
  (JPEG/PNG/WebP) uniformly and guarantees 300 DPI. A photo whose blob is missing is
  skipped, leaving its whitespace (never a broken image).
- Paper fills the media box; text uses the mapped standard font in the album ink (sRGB).

### UI

- An **Export** button in the top bar opens an `ExportPanel`: target (Blurb + size),
  interior page count, paper selector, estimated spine width (mm) with an editable
  override, an sRGB note, and **Download cover wrap** / **Download interior** actions
  (file names include the project name). Downloads via an object URL + `<a download>`.
- Store: a small `exportSettings` slice is not required; the panel can hold paper +
  spine-override in local component state and read the rest from the store. (No new
  persisted field unless review asks for it.)

## Acceptance criteria

- [x] Export produces a cover-wrap PDF (back + spine + front, correct wrap width for the
      spine) and an interior PDF (inside front, pages, inside back), each page trim+bleed
      with the media/trim boxes set.
- [x] Every photo prints at its contain-fit box, ratio preserved, at ~300 DPI; a
      portrait stays portrait and a panorama stays a panorama, never cropped.
- [x] The printed layout matches the on-screen preview for the same book size (same
      regions, same margins).
- [x] The spine shows the effective spine title; the wrap width tracks the spine width;
      the estimate is overridable and the override is used.
- [x] The paper bleeds to the media-box edge (no white trim edge).
- [x] `computeLayout` / `src/lib/layout.ts` unchanged; print geometry tests assert ratio
      + containment; existing engine tests stay green.

## Edge cases

- **Empty page**: prints blank paper (no crash).
- **Text-only cover / spine with no title**: prints paper with the text it has (or none).
- **Photo blob missing**: skipped, whitespace kept.
- **Non-JPEG/PNG source** (WebP): re-encoded through canvas to JPEG, still embeds.
- **1 content page / 0 content pages**: interior still emits the inside covers; page
  count and spine estimate handle small books.
- **Very wide panorama / tall portrait**: contain-fit inside its region, never clipped.
