# Architecture

The canonical, essentials-only architecture reference for Passepartout. It is kept
current as features ship (see the `passepartout-feature` skill, Phase 6). For a
gentle intro read [overview.md](overview.md); for stack and conventions read
`CLAUDE.md`. Deep per-feature design lives under `specs/`.

## The one rule (the invariant everything serves)

A photo's aspect ratio is never changed and a photo is never clipped. The engine
may only choose a photo's **size** and the **whitespace** around it. Every layer
below exists to honour this: even inside a fixed grid slot a photo is *contained*
(fit + centered), never stretched to fill. Anything that would non-proportionally
resize a photo is out of scope by definition.

No-crop is the **default**, not a ban. The deliberate, opt-in exceptions are a page's
**Fill** mode (spec 012, crop a single photo to cover the page) and the per-photo **crop
tool** (spec 015, keep a chosen rectangle of a photo). Both are off by default, explicit,
and never *distort* (the crop is proportional; the kept region is shown contain-fit). Every
un-opted photo keeps the full no-crop guarantee.

## Module map

```
src/
├── main.tsx            # Entry point
├── App.tsx             # Shell: TopBar + Library + pages / empty state
├── index.css           # Design tokens (both themes) + a few structural rules
├── types.ts            # Photo, AlbumPage, PageFormat, whitespace + layout constants
├── store.ts            # Zustand album store, ALL state and mutations + auto-save
├── persistence.ts      # IMPURE IndexedDB adapter: project docs + image blobs
├── lib/
│   ├── layout.ts       # PURE engine: template -> regions -> contain-fit cells; whitespaceToDensity
│   ├── layouts.ts      # PURE layout catalog on a fixed 12x12 grid (CellRect templates) + resolveCells
│   ├── project.ts      # PURE project helpers: ProjectDoc, serialize/hydrate/duplicate, spine
│   ├── book-sizes.ts   # PURE physical book-size catalog (Blurb trim sizes) + print constants
│   ├── print.ts        # PURE print geometry (media/trim/content boxes, spine) in PDF points
│   ├── pdf-export.ts   # IMPURE PDF builder (pdf-lib + canvas): interior + cover-wrap files
│   ├── themes.ts       # PURE album-theme catalog (fonts + color palettes) + coercion
│   ├── theme-vars.ts   # PURE map: resolved theme + OS mode -> CSS custom properties
│   ├── text-sizes.ts   # PURE per-role text-size catalog (title/subtitle/caption) + scale vars
│   ├── exif.ts         # Best-effort EXIF DateTimeOriginal reader
│   ├── preview.ts      # PURE book-preview helpers: booklet leaf order, spread pairing, fit-to-stage sizing
│   ├── fit.ts          # PURE cover-crop geometry (coverSourceRect) for full-page Fill photos
│   ├── grid-edit.ts    # PURE move/resize/restack helpers for free placement (spec 013 Phase B)
│   ├── crop.ts         # PURE photo-crop geometry: effectiveRatio, crop-rect edit, cropImgBox (spec 015)
│   └── demo.ts         # Canvas-generated sample photos (with blobs, for persistence)
├── useApplyTheme.ts    # Hook: write the active theme's CSS vars onto <html>, react to OS theme
├── viewStore.ts        # Ephemeral view prefs (showGrid, editor zoom), localStorage-persisted, not album data
└── components/
    ├── TopBar.tsx      # Global controls: project switcher, style (theme), format, import
    ├── ProjectMenu.tsx # Project switcher: new / open / rename / duplicate / delete
    ├── ThemeMenu.tsx   # Album style picker: font + color palette (project-level)
    ├── CoverCard.tsx   # Front / back cover: title + subtitle + optional contained photo
    ├── Library.tsx     # Photo tray (drag source + drop-to-remove)
    ├── PageCard.tsx    # Per-page controls: title, count 1-6, layout picker, whitespace
    ├── LayoutThumb.tsx # Tiny SVG miniature of a layout template
    ├── SizeMenu.tsx    # Book-size (Blurb trim) picker in the top bar
    ├── SpineCard.tsx   # Spine title editor + vertical spine preview
    ├── ExportPanel.tsx # Export button: interior + cover-wrap PDF download (Blurb)
    ├── Paper.tsx       # Measures the page box, calls the engine, renders region cells
    ├── Thumb.tsx       # Faithful page/cover mini-render (reuses the engine, no crop)
    ├── BookPreview.tsx # Full-screen read-only viewer: double-page spreads + thumbnail rail (spec 011)
    ├── PreviewPaper.tsx# Read-only faithful leaf render for the preview (reuses the engine, no crop)
    ├── PageRail.tsx    # Right rail: page thumbnails, drag-to-reorder, click-to-scroll
    ├── CroppedImg.tsx  # Render a photo into a box, showing only its crop region (spec 015)
    ├── CropEditor.tsx  # Full-screen crop editor: image + draggable crop rectangle (spec 015)
    └── dnd.ts          # Shared drag-and-drop payload keys (photo + page)
```

Three hard boundaries:

- **`src/lib/` is pure.** No DOM, no React, no store, no IndexedDB. It takes plain
  numbers/data and returns plain numbers/data, so it is unit-testable and paints a
  300 DPI PDF page from the same math (`print.ts`). Keep it that way. The one exception
  is `pdf-export.ts`, which is explicitly impure (pdf-lib + canvas, browser-only): it
  *consumes* the pure geometry from `print.ts` and draws it.
- **`src/store.ts` owns all state.** Components never mutate state directly; they
  call actions. This is the single place the data model changes.
- **`src/persistence.ts` is the only impure I/O.** It is the sole module that touches
  IndexedDB. Every call degrades gracefully (a missing IndexedDB never crashes the
  app), and the pure serialization it stores comes from `src/lib/project.ts`.

## Data model (`src/types.ts`)

- **Photo**: one imported image. Native size, `ratio`, `caption`, capture `time`, an
  optional `crop` (spec 015): a normalized kept sub-rectangle, an optional `mask` (spec
  018): the id of a decorative shape from the enrichable catalog `src/lib/masks.ts` (opt-in,
  clips only the pixels outside the shape), optional decorative frame fields (`frame` /
  `frameColor` / `frameText` / `frameWidth` / `frameFocus`, spec 019, catalog
  `src/lib/frames.ts`): a Border mats the photo whole in a uniform border (additive, never
  clips) or a Polaroid shows it in a square, pannable, cover-cropped window with a note band;
  the engine sizes a framed cell to the frame's outer ratio (`frameLayoutRatio`), and an
  optional `rotation` (spec 020): a small decorative tilt applied as a visual transform on
  top of the layout (the whole crop/mask/frame unit tilts; the engine never sees it). It stores NO placement:
  a photo can appear on many pages / cover faces at once and its usage is derived (spec 017,
  `src/lib/usage.ts`). Absent crop = the whole image (no crop, the default). The kept region's ratio is
  the photo's **effective ratio** (`src/lib/crop.ts`), which drives the layout.
- **AlbumPage**: ordered `photoIds`, optional `title` and `subtitle` (both rendered on
  the paper, contained in whitespace, never on a photo), a `whitespace` level
  (`1 .. WHITESPACE_LEVELS`, currently 8), a `layoutId`, and optional full-page fields
  (spec 012): `fullPage` (`"contain"` = Fit, no crop; `"cover"` = Fill, cropped;
  effective only with one photo, cleared otherwise by `syncLayout`) and `fullPageFocus`
  (`{x,y}` in 0..1, the Fill crop focus, default centered).
- **Book size** (`src/lib/book-sizes.ts`): the physical print size a project targets,
  one of a curated set of real Blurb trim sizes (mm + orientation). Its ratio drives the
  page and cover preview, so what you see is what prints. Carries the print constants
  (`BLEED_MM`, `SAFE_MM`, `PRINT_DPI`) the export (spec 009) reuses. Replaced the abstract
  `PageFormat` (kept only as the legacy shape `bookSizeForLegacyFormat` migrates on load).
- **Spine** (`Spine` in `src/types.ts`): the bound edge, a `title` that defaults to the
  front cover title when empty (`effectiveSpineTitle`). Prepared here; painted in the
  cover wrap by the export (spec 009).
- **Layout template** (`src/lib/layouts.ts`, spec 013): a named set of `CellRect`s on a
  fixed 12 x 12 page grid (`GRID_COLS`/`GRID_ROWS`). Each rectangle (col/row/colSpan/
  rowSpan) holds one photo; rectangles are mapped to the page's photos in order. The
  catalog is pure data versioned with the app; a page persists a `layoutId` and, once the
  free-placement editor detaches it, an explicit `placement: CellRect[]`. `resolveCells`
  returns a valid `placement`, else the named template, else a balanced `autoCells(count)`
  (unknown ids and counts outside 1-6). This grid substrate is the shared model for the
  layout catalog and a future free-placement editor (Phase B).
- **Project** (`src/lib/project.ts`): one album. `ProjectDoc` = meta (`id`, `name`,
  `createdAt`, `updatedAt`) + `bookSize` + `spine` + `fontTheme` + `colorTheme` + `pages` +
  `StoredPhoto[]` (`Photo` minus the runtime `url`) + the four covers (`frontCover`,
  `insideFrontCover`, `insideBackCover`, `backCover`). Persisted in IndexedDB; a photo's
  image bytes live in a separate `images` blob store keyed by photo id. The ephemeral
  object `url` is never persisted: `serializeProject` strips it and `hydratePhotos`
  re-attaches a fresh one from the blob.
- **Cover** (`Cover` in `src/types.ts`): one booklet cover face = `title` + `subtitle`
  + an optional `photoId` (a library photo, contained never cropped) + `whitespace`. A
  cover sheet has **four faces** (`CoverFace`): `front`, `insideFront`, `insideBack`,
  `back`. `coverOrDefault` keeps pre-cover documents loadable; `cleanCover` nulls a
  `photoId` whose photo is gone.
- **Album theme** (`src/lib/themes.ts`): two project-level choices, `fontTheme` and
  `colorTheme`, each an id into a small curated catalog (like the layout catalog). A
  `FontTheme` is a system-font stack (offline, no downloads) applied to album text; a
  `ColorTheme` carries the album's fixed print colors (`paper`, `ink`, `inkSoft`) plus
  an `accent` (light/dark pair) that also recolors the app chrome. `fontThemeOrDefault`
  / `colorThemeOrDefault` default an unknown or pre-theme id, exactly like
  `coverOrDefault`. The choice is applied as CSS custom properties by `useApplyTheme`
  (impure) from the pure map in `theme-vars.ts`; album print colors stay fixed across
  OS light/dark while the accent variant follows it.
- **Text size** (`src/lib/text-sizes.ts`): a third project-level album-style axis,
  `textSizes` = one level (`sm | md | lg | xl`) per text **role**. Five roles keep the
  cover and page text distinct: `coverTitle`, `coverSubtitle`, `pageTitle`,
  `pageSubtitle`, `caption`. Each level is a multiplier (`md` = 1, so defaults are
  unchanged) emitted by `textScaleVars` as `--cover-title-scale` /
  `--cover-subtitle-scale` / `--page-title-scale` / `--page-subtitle-scale` /
  `--caption-scale`; the album text sites multiply their base `fontSize` by the role var
  (`calc(... * var(--page-title-scale))`). `textSizesOrDefault` coerces a missing object
  or an unknown per-role value to `md`. `useApplyTheme` writes these vars too. No engine
  involvement: only text size changes, photo geometry is the engine's alone.

Altitude rule: **per-page state lives on `AlbumPage`; global state lives at the store
root.** Match the right altitude when adding a field.

## The reactive / render flow

```
Import / demo
  -> store.photos (sorted by capture time)
    -> store.pages (auto-distributed, DEFAULT_PER_PAGE per page)
      -> PageCard controls: title, count 1-6, layout picker, whitespace 1-8
        -> Paper measures its content box in pixels (ResizeObserver)
          -> computeLayout(items, w, h, node, { density })   [PURE]
            -> one fixed region per slot, each photo contained + centered, no overflow
```

State flows one way: a control calls a store action, the store produces a new
`pages`/`photos` array, subscribed components re-render, and `Paper` re-measures and
re-lays-out. `syncLayout` runs inside every mutation that changes a page's photo
count (`setPageCount`, `placeOnPage`, `removeFromPage`) to keep `layoutId` valid.

`App` renders the four cover faces in booklet order: **front cover** then **inside
front cover**, the pages, then **inside back cover** then **back cover**, so a project
reads as a complete booklet. A cover's photo goes through the same engine with a single
full-grid cell (`resolveCells("single", 1)`), so it is contained exactly like a page
photo, never cropped.

## Persistence and projects

The active project is kept in IndexedDB so a refresh restores it, and several named
projects can coexist.

```
App mount -> store.initProjects() -> load last-active ProjectDoc + its blobs
  -> hydratePhotos (fresh object URLs) -> photos/pages/format
any album mutation -> scheduleSave() (debounced) -> saveProjectDoc(serializeProject(state))
import / demo -> putImage(blob) once + object URL
switch project -> revoke old object URLs -> load new doc + blobs -> hydrate
```

Rules that keep this correct: image blobs are written once at import time (the
debounced save only writes the small metadata doc); `scheduleSave` is a no-op unless
there is an active project and IndexedDB is available; opening/creating/deleting a
project revokes the previous photos' object URLs to avoid leaks; and a photo whose
blob is missing on load is dropped (its page references cleaned) rather than crashing.
The `ProjectMenu` in the top bar drives create / open / rename / duplicate / delete;
duplication copies each blob under a new photo id so projects never share image bytes.

## The layout engine (`src/lib/layout.ts`)

`computeLayout(items, contentW, contentH, cells, { density })`:

1. **Regions**: `gridRegions(cells, contentW, contentH)` maps each `CellRect` to a pixel
   region on the fixed 12 x 12 grid (equal tracks, a gutter between them, so a full-grid
   single cell equals the content box and adjacent cells are separated by one gutter).
   This structure is a pure function of the cells and the box, **independent of density**.
2. **Fit**: inside each region, contain-fit the photo (`boxH = min(rh, rw / ratio)`),
   scale it by `fillFraction = 0.6 + 0.4 * density/100` (range 0.60 .. 1.00) and
   center it. Never above the contain fit, so the ratio is kept and the fixed
   inter-region gap is the guaranteed minimum whitespace.

Whitespace is chosen in the UI as a discrete level; `whitespaceToDensity(level)` maps
`1 .. WHITESPACE_LEVELS` to density `100 .. 0` (level 1 = least white, photo fills its
region). The engine itself stays on continuous density so the future PDF painter can
reuse it.

Because regions are density-independent, the **layout picker chooses the arrangement**
and the **whitespace level only makes photos breathe** inside that frozen arrangement.
Dragging whitespace never re-groups photos.

## How the invariant is enforced

- The engine only ever *scales* a photo box: `boxW = boxH * ratio`, so `w / h`
  equals `ratio` exactly at every density and template. There is no crop parameter.
- `Paper` renders each cell with no `overflow: hidden` on the photo, and the contain
  fit keeps the box inside its region, which is inside the content box.
- Tests guard it: `src/lib/layout.test.ts` asserts ratio preservation
  (`toBeCloseTo(ratio, 6)`), region/box containment, frozen structure across density,
  and panorama containment; `src/lib/layouts.test.ts` checks catalog invariants;
  `src/store.test.ts` checks `syncLayout`.

## Where things go (extension points)

- **A new layout template**: add a `GridTemplate` to `CATALOG` in `src/lib/layouts.ts`
  with a stable new `id` (never rename an existing id, pages persist it) and its `cells`
  as `CellRect`s on the 12 x 12 grid (spans sum to 12 per axis). No engine change needed;
  `LayoutThumb` and `Paper` render it for free.
- **A new page control**: add the field to `AlbumPage` (`src/types.ts`), a store
  action, and a control in `PageCard.tsx`. Keep it per-page unless it is truly global.
- **A new book size**: add a `BookSize` (real trim mm + orientation) to `BOOK_SIZES` in
  `src/lib/book-sizes.ts`; `SizeMenu` and every ratio consumer pick it up for free.
- **A new album font or color palette**: add a `FontTheme` / `ColorTheme` (with a stable
  new id) to the catalog in `src/lib/themes.ts`. `ThemeMenu`, `theme-vars.ts` and
  `useApplyTheme` pick it up for free; no engine or store change.
- **Free placement** (shipped, spec 013 Phase B): a per-page "Edit layout" mode (local to
  `PageCard`) turns `Paper` into an editor: dragging a cell moves it and corner handles
  resize it, snapped to the grid (`src/lib/grid-edit.ts`, pure), writing `page.placement`
  via `store.setPagePlacement`. Overlap is allowed; a per-cell `z` (front/back) drives a
  pure `drawOrder(cells)` that `Paper` / `Thumb` / `PreviewPaper` / `print.ts` all paint
  in, so layers match everywhere. Shift-dragging pans the contain-fit photo within its
  cell's whitespace (a per-cell anchor `ax/ay`; the engine returns the photo's `ox/oy`
  offset in `PlacedCell`), never cropping. The first edit detaches the page from its
  template; `removeFromPage` / `placeOnPage` reconcile `placement` by index. The engine is
  unchanged in spirit (still contain-fit, no crop; it now also returns the anchored offset).
- **A new text role or size level**: extend `TEXT_ROLES` / `TEXT_SIZE_LEVELS` in
  `src/lib/text-sizes.ts` and add the matching `--<role>-scale` var to the text site.
  `ThemeMenu` renders the new row/level automatically.
- **A new persisted field**: add it to `ProjectDoc` (via `AlbumPage`/`Photo` or the doc
  itself) in `src/lib/project.ts`; `serializeProject`/`hydratePhotos` carry it and the
  IndexedDB adapter stores it with no change. Bump the DB version in `persistence.ts`
  only if a store shape changes.
- **Print / export** (shipped, spec 009): `print.ts` reuses `computeLayout` to place
  photos in PDF points on a media box = trim + bleed; `pdf-export.ts` paints it with
  pdf-lib into a Blurb-ready interior PDF (inside front, pages, inside back) and a
  cover-wrap PDF (back + spine + front), each photo re-encoded to a 300 DPI sRGB JPEG at
  its exact contain-fit box (never cropped), text as vector. Same math, different
  surface: this is why the engine is pure. `Thumb.tsx` is the same reuse at screen
  scale. A project-file export/import would build on `ProjectDoc` + the `images` blobs.
- **Full-page photo** (shipped, spec 012): a per-page `fullPage` mode for a single-photo
  page. `Fit` (`contain`) contain-fits the photo to the whole page (into the print bleed),
  no crop; `Fill` (`cover`) covers the page, cropped to the page ratio at `fullPageFocus`.
  On screen every surface uses CSS `object-fit` (+ `object-position` for Fill), so nothing
  distorts; the editor page lets Fill pan to set the focus. In print, `interiorPageGeometry`
  returns the media box as the content box and flags a `cover` photo; `pdf-export`
  re-encodes the crop with `coverSourceRect` (`src/lib/fit.ts`), so the exported JPEG
  matches the on-screen crop with no PDF clipping. The engine is untouched.
- **Photo crop** (shipped, spec 015): a `Crop` button in Edit layout opens `CropEditor`
  (the full image + a draggable crop rectangle, free aspect). It writes `Photo.crop` via
  `store.setPhotoCrop`. Every renderer lays out by `effectiveRatio(photo)` and draws the
  crop with `CroppedImg` (or, in `Thumb`, the same percent math); `pdf-export` crops the
  source at re-encode (9-arg `drawImage`). An un-cropped photo is the whole image, contained.
  `Photo.crop` travels in `StoredPhoto` (no `project.ts` change). Full-page mode (spec 012)
  currently shows the whole image (crop composes with cells, not with full-page cover).
- **Book preview** (shipped, spec 011): a full-screen, read-only viewer
  (`BookPreview.tsx` + `PreviewPaper.tsx`) that reads the whole book in double-page
  spreads. `src/lib/preview.ts` (pure) gives the booklet leaf order, the spread pairing
  (cover single, then verso/recto), and `fitSpread` (largest page size that fills the
  stage while keeping the page aspect). Each leaf reuses `computeLayout` exactly like
  `Paper`, so the preview never crops. View state (open flag, spread index) is ephemeral
  and lives in the component, not the store.
- **Page order**: content pages are ordered by their index in the store's `pages`
  array (covers are separate `Cover` state, structurally fixed). `store.movePage`
  permutes that array; `PageRail` drives it by drag and drop. No new field: order is the
  array order, already serialized. Each page owns its own `photoIds`, so permuting the
  page array never disturbs a photo or a layout.

## Roadmap hooks

PDF export at 300 DPI + bleed, imprimeur presets, full-bleed spreads, page/photo
reorder, and project persistence all build on the same pure engine and the
`layoutId` + `whitespace` data model. See the roadmap in `CLAUDE.md`.
