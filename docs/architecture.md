# Architecture

The canonical, essentials-only architecture reference for Passepartout. It is kept
current as features ship (see the `passepartout-feature` skill, Phase 6). For a
gentle intro read [overview.md](overview.md); for stack and conventions read
`CLAUDE.md`. Deep per-feature design lives under `specs/`.

## The one rule (the invariant everything serves)

A photo's aspect ratio is never changed and a photo is never clipped. The engine
may only choose a photo's **size** and the **whitespace** around it. Every layer
below exists to honour this: even inside a fixed grid slot a photo is *contained*
(fit + centered), never stretched to fill. Anything that would crop, clip, or
non-proportionally resize a photo is out of scope by definition.

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
│   ├── layouts.ts      # PURE layout template catalog (nested split trees) + helpers
│   ├── project.ts      # PURE project helpers: ProjectDoc, serialize/hydrate/duplicate
│   ├── exif.ts         # Best-effort EXIF DateTimeOriginal reader
│   └── demo.ts         # Canvas-generated sample photos (with blobs, for persistence)
└── components/
    ├── TopBar.tsx      # Global controls: project switcher, format, import, auto-arrange
    ├── ProjectMenu.tsx # Project switcher: new / open / rename / duplicate / delete
    ├── Library.tsx     # Photo tray (drag source + drop-to-remove)
    ├── PageCard.tsx    # Per-page controls: title, count 1-4, layout picker, whitespace
    ├── LayoutThumb.tsx # Tiny SVG miniature of a layout template
    ├── Paper.tsx       # Measures the page box, calls the engine, renders region cells
    └── dnd.ts          # Shared drag-and-drop payload key
```

Three hard boundaries:

- **`src/lib/` is pure.** No DOM, no React, no store, no IndexedDB. It takes plain
  numbers/data and returns plain numbers/data, so it is unit-testable and will later
  paint a 300 DPI PDF page from the same math. Keep it that way.
- **`src/store.ts` owns all state.** Components never mutate state directly; they
  call actions. This is the single place the data model changes.
- **`src/persistence.ts` is the only impure I/O.** It is the sole module that touches
  IndexedDB. Every call degrades gracefully (a missing IndexedDB never crashes the
  app), and the pure serialization it stores comes from `src/lib/project.ts`.

## Data model (`src/types.ts`)

- **Photo**: one imported image. Native size, `ratio` (the sacred value), `caption`,
  capture `time`, and `pageId` (`null` while still in the library).
- **AlbumPage**: ordered `photoIds`, optional `title`, a `whitespace` level
  (`1 .. WHITESPACE_LEVELS`, currently 8), and a `layoutId`.
- **PageFormat**: `square | landscape | portrait`, mapped to a page aspect ratio.
- **Layout template** (`src/lib/layouts.ts`): a named, nested split tree of the page
  box. A node is either a `slot` (holds one photo) or a `split` along an axis
  (`h` = side-by-side columns, `v` = stacked rows) into weighted children. Leaves
  are visited in order and mapped to the page's photos in order. The catalog is pure
  data versioned with the app; a page persists only the `layoutId` that references it
  (unknown ids and counts outside 1-4 resolve to a balanced `autoTemplate`).
- **Project** (`src/lib/project.ts`): one album. `ProjectDoc` = meta (`id`, `name`,
  `createdAt`, `updatedAt`) + `format` + `pages` + `StoredPhoto[]` (`Photo` minus the
  runtime `url`). Persisted in IndexedDB; a photo's image bytes live in a separate
  `images` blob store keyed by photo id. The ephemeral object `url` is never persisted:
  `serializeProject` strips it and `hydratePhotos` re-attaches a fresh one from the blob.

Altitude rule: **per-page state lives on `AlbumPage`; global state lives at the store
root.** Match the right altitude when adding a field.

## The reactive / render flow

```
Import / demo
  -> store.photos (sorted by capture time)
    -> store.pages (auto-distributed, DEFAULT_PER_PAGE per page)
      -> PageCard controls: title, count 1-4, layout picker, whitespace 1-8
        -> Paper measures its content box in pixels (ResizeObserver)
          -> computeLayout(items, w, h, node, { density })   [PURE]
            -> one fixed region per slot, each photo contained + centered, no overflow
```

State flows one way: a control calls a store action, the store produces a new
`pages`/`photos` array, subscribed components re-render, and `Paper` re-measures and
re-lays-out. `syncLayout` runs inside every mutation that changes a page's photo
count (`setPageCount`, `placeOnPage`, `removeFromPage`) to keep `layoutId` valid.

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

`computeLayout(items, contentW, contentH, node, { density })`:

1. **Regions**: walk the template `node` over the content box, collecting one region
   rect per slot (leaves in order). Siblings are separated by a fixed structural gap
   and sized by optional weights. This structure is a pure function of the template
   and the box, **independent of density**.
2. **Fit**: inside each region, contain-fit the photo (`boxH = min(rh, rw / ratio)`),
   scale it by `fillFraction = 0.5 + 0.5 * density/100` (range 0.50 .. 1.00) and
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

- **A new layout template**: add a `LayoutTemplate` to `CATALOG` in
  `src/lib/layouts.ts` with a stable new `id` (never rename an existing id, pages
  persist it). No engine change needed; `LayoutThumb` and `Paper` render it for free.
- **A new page control**: add the field to `AlbumPage` (`src/types.ts`), a store
  action, and a control in `PageCard.tsx`. Keep it per-page unless it is truly global.
- **A new page format**: add it to `PageFormat` and `PAGE_ASPECT` in `src/types.ts`.
- **A new persisted field**: add it to `ProjectDoc` (via `AlbumPage`/`Photo` or the doc
  itself) in `src/lib/project.ts`; `serializeProject`/`hydratePhotos` carry it and the
  IndexedDB adapter stores it with no change. Bump the DB version in `persistence.ts`
  only if a store shape changes.
- **Print / export**: reuse `computeLayout`'s numbers to paint a canvas or PDF page at
  print resolution. Same math, different surface: this is why the engine is pure. A
  project-file export/import would build on `ProjectDoc` + the `images` blobs.

## Roadmap hooks

PDF export at 300 DPI + bleed, imprimeur presets, full-bleed spreads, page/photo
reorder, and project persistence all build on the same pure engine and the
`layoutId` + `whitespace` data model. See the roadmap in `CLAUDE.md`.
