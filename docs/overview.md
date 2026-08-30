# Overview

A gentle intro to how Passepartout is built. For the essentials-only, kept-current
architecture reference (module map, engine, extension points), see
[architecture.md](architecture.md).

## The one rule

A photo's aspect ratio is never changed and the photo is never clipped. The layout
engine may only pick a photo's **size** and the **whitespace** around it. This rule
is enforced in code (`src/lib/layout.ts` returns cells whose `w/h` always equals the
photo's `ratio`) and guarded by tests (`src/lib/layout.test.ts`). Even inside a fixed
grid slot a photo is *contained* (fit + centered), never stretched to fill. The deliberate,
opt-in exceptions are a page's **Fill** mode (spec 012) and the per-photo **crop tool**
(spec 015); both are off by default and never distort (the kept region is shown contained).

## Data model

- **Photo** (`src/types.ts`): one imported image. Holds its native size, `ratio`,
  `caption` and capture `time`. It does NOT store where it is placed: a photo can appear
  on any number of pages and cover faces at once (spec 017), and its usage is derived from
  the pages' photo ids and the cover photo ids (see `src/lib/usage.ts`).
- **AlbumPage**: an ordered list of photo ids, an optional `title` and `subtitle`, a
  per-page `whitespace` level (1 .. `WHITESPACE_LEVELS`), a `layoutId` (which
  arrangement template is applied), and optional full-page fields (`fullPage` Fit/Fill,
  `fullPageFocus` for the Fill crop; spec 012).
- **Note** (spec 039): a small block of text placed freely on a page or a cover face
  (`notes` on `AlbumPage` and on `Cover`). Its position, its wrapping width and its size
  are fractions of the page, so it lands on the same spot in the editor, in a thumbnail,
  in the book preview and in the PDF. It is an overlay on top of the finished layout: it
  never takes part in `computeLayout`, so a note can never move or crop a photo. Its six
  typefaces are shipped with the app and embedded in the PDF, which is what makes the
  printed note identical to the previewed one, line breaks included.
- **Book size** (`src/lib/book-sizes.ts`): a real Blurb trim size (mm + orientation)
  whose ratio drives the page, so the preview matches the printed page. Carries the
  print constants the export will reuse. Superseded the abstract `PageFormat`.
- **Spine** (`Spine`): the bound edge; a title that defaults to the front cover title.
- **Print export** (`src/lib/print.ts` pure + `src/lib/pdf-export.ts` impure): reuses the
  engine to paint a Blurb-ready cover-wrap PDF and interior PDF at 300 DPI, sRGB, with
  bleed. Photos embed at full resolution and stay contain-fit; the paper bleeds.
- **Layout template** (`src/lib/layouts.ts`, spec 013): a named set of cell rectangles on
  a fixed 12 x 12 page grid (one rectangle per photo). The catalog is pure data versioned
  with the app; a page persists a `layoutId` and, once detached by the free-placement
  editor, an explicit `placement` of cell rectangles. This grid is the shared model for
  templates and free placement.
- **Album theme** (`src/lib/themes.ts`): two project-level choices, a `fontTheme`
  (one of seven styles, each set in a font the app ships and the PDF embeds, so the
  printed album reads exactly like the preview, spec 040) and a `colorTheme` (the album's paper +
  ink print colors plus an accent that also recolors the app chrome). Both default so
  existing albums look unchanged. Picked in the top bar's **Style** menu.
- **Text size** (`src/lib/text-sizes.ts`): a per-role size across five roles (cover
  title/subtitle, page title/subtitle, caption), four levels each (S/M/L/XL), also
  project-level and picked in the **Style** menu. Medium is today's size; levels scale
  the text via CSS vars, never the photos. Pages carry their own `title` and `subtitle`.
- **Project** (`src/lib/project.ts`): one album (pages + photos + book size + spine + theme + four
  **cover** faces). The active project is auto-saved to IndexedDB (image bytes as blobs,
  metadata as a JSON doc) so a refresh restores it, and several named projects can
  coexist. See the persistence section in [architecture.md](architecture.md).
- **Cover**: the four faces of the booklet cover (front, inside front, inside back,
  back), each a title + subtitle + an optional photo dragged from the library
  (contained, never cropped). The text sits in a fixed band above the photo or under it,
  per face (spec 042). They render front, inside front, pages, inside back, back.

All state and every mutation live in the Zustand store (`src/store.ts`). Components
never mutate state directly; they call store actions. The store persists the active
project through `src/persistence.ts` (the only IndexedDB module).

## The reactive flow

```
Import
  -> store.photos (sorted by capture time), library only; one empty page if none
    -> PageCard controls (title, slot count 1-6, layout picker, whitespace, delete)
      -> drag a photo from the Library onto a page -> fills the next empty slot
        -> Paper measures its content box in pixels
          -> computeLayout(items, w, h, cells, { density })  [pure]
            -> one fixed region per cell, each photo contained + centered
               (slots beyond the placed photos render as empty "+" drop targets)
```

## The layout engine

`computeLayout(items, contentW, contentH, cells, { density })`:

1. `gridRegions` maps each cell rectangle to a **region rect** on the fixed 12 x 12 grid
   (equal tracks with a gutter between them). This structure is **independent of density**.
2. Inside each region, contain-fit the photo (`boxH = min(rh, rw / ratio)`), scale it
   by a `fillFraction` (0.60 .. 1.00) driven by the page's whitespace level (mapped to
   density by `whitespaceToDensity`), and center it. Never above the contain fit: the
   ratio is kept and the fixed inter-region gap is the guaranteed minimum whitespace.

So the **layout picker** chooses the arrangement, and the **whitespace level** only
makes the photos breathe inside that frozen arrangement - it never re-groups them.
Templates that are pure rows (row of 3, column of 3) and grids (2x2, 1 beside 2) are
all the same split tree; the engine treats them uniformly. Counts outside 1-6 (from
dragging many photos onto one page) fall back to a balanced auto template.

Because the engine is pure and returns plain numbers, the same function will later
paint a 300 DPI PDF page: same math, different canvas.

## Interaction

- **Import** adds photos to the Library only; nothing is placed automatically. The
  album starts with one empty page ready to fill.
- **Drag** a photo from the Library onto a page to fill its next empty slot; drag it
  back to the Library (or use the hover `×`) to remove it, which leaves the slot empty.
- **Count buttons (1-6)** set the page's slot count (how many photos it is laid out
  for). Empty slots show as `+` drop targets you fill by dragging; no photo is ever
  pulled from the Library. Lowering the count returns the overflow photos to the Library.
- **Layout picker** offers the arrangements available for the current slot count (rows
  and grids); picking one reshapes the page without touching the photos' framing.
- **Whitespace levels (1-8)** scale the photos inside the fixed layout (level 1 fills
  the region, 8 is airiest); they never re-group. A fresh page starts at level 1, so
  photos are maximized by default (spec 010).
- **Title** is edited in the page header and shown centered on the page.
- **Caption** is edited inline under each photo.
- **Page rail** (right side, wide screens) shows a faithful thumbnail of every cover
  and page; drag a content-page thumbnail to reorder pages (covers stay fixed), or
  click one to scroll to that page. Thumbnails reuse the layout engine, so they never
  crop either.
