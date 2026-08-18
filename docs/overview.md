# Overview

A gentle intro to how Passepartout is built. For the essentials-only, kept-current
architecture reference (module map, engine, extension points), see
[architecture.md](architecture.md).

## The one rule

A photo's aspect ratio is never changed and the photo is never clipped. The layout
engine may only pick a photo's **size** and the **whitespace** around it. This rule
is enforced in code (`src/lib/layout.ts` returns cells whose `w/h` always equals the
photo's `ratio`) and guarded by tests (`src/lib/layout.test.ts`). Even inside a fixed
grid slot a photo is *contained* (fit + centered), never stretched to fill.

## Data model

- **Photo** (`src/types.ts`): one imported image. Holds its native size, `ratio`,
  `caption`, capture `time`, and which page it sits on (`pageId`, or `null` when it is
  still in the library).
- **AlbumPage**: an ordered list of photo ids, an optional `title` and `subtitle`, a
  per-page `whitespace` level (1 .. `WHITESPACE_LEVELS`), and a `layoutId` (which
  arrangement template is applied).
- **PageFormat**: `square | landscape | portrait`, mapped to an aspect ratio.
- **Layout template** (`src/lib/layouts.ts`): a named, nested split tree of the page
  box (`slot`, or a `split` along an axis into weighted children). The catalog is pure
  data versioned with the app; a page persists only the `layoutId` that references it.
- **Album theme** (`src/lib/themes.ts`): two project-level choices, a `fontTheme`
  (a system-font stack applied to album text) and a `colorTheme` (the album's paper +
  ink print colors plus an accent that also recolors the app chrome). Both default so
  existing albums look unchanged. Picked in the top bar's **Style** menu.
- **Text size** (`src/lib/text-sizes.ts`): a per-role size across five roles (cover
  title/subtitle, page title/subtitle, caption), four levels each (S/M/L/XL), also
  project-level and picked in the **Style** menu. Medium is today's size; levels scale
  the text via CSS vars, never the photos. Pages carry their own `title` and `subtitle`.
- **Project** (`src/lib/project.ts`): one album (pages + photos + format + theme + four
  **cover** faces). The active project is auto-saved to IndexedDB (image bytes as blobs,
  metadata as a JSON doc) so a refresh restores it, and several named projects can
  coexist. See the persistence section in [architecture.md](architecture.md).
- **Cover**: the four faces of the booklet cover (front, inside front, inside back,
  back), each a title + subtitle + an optional photo dragged from the library
  (contained, never cropped). They render front, inside front, pages, inside back, back.

All state and every mutation live in the Zustand store (`src/store.ts`). Components
never mutate state directly; they call store actions. The store persists the active
project through `src/persistence.ts` (the only IndexedDB module).

## The reactive flow

```
Import / demo
  -> store.photos (sorted by capture time)
    -> store.pages (auto-distributed, DEFAULT_PER_PAGE per page)
      -> PageCard controls (title, count 1-6, layout picker, whitespace, delete)
        -> Paper measures its content box in pixels
          -> computeLayout(items, w, h, node, { density })  [pure]
            -> one fixed region per slot, each photo contained + centered
```

## The layout engine

`computeLayout(items, contentW, contentH, node, { density })`:

1. Walk the template `node` over the content box, collecting one **region rect** per
   slot (leaves in order). Siblings are separated by a fixed structural gap and sized
   by optional weights. This structure is **independent of density**.
2. Inside each region, contain-fit the photo (`boxH = min(rh, rw / ratio)`), scale it
   by a `fillFraction` (0.50 .. 1.00) driven by the page's whitespace level (mapped to
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

- **Drag** a photo from the Library onto a page to place it; drag it back to the
  Library (or use the hover `×`) to remove it.
- **Count buttons (1-6)** grow the page by pulling the next photos in chronological
  order (first from the Library, then borrowing from the following pages when the
  Library is empty), or shrink it by returning the last ones to the Library.
  Changing the count resets the page to that count's default layout.
- **Layout picker** offers the arrangements available for the current count (rows and
  grids); picking one reshapes the page without touching the photos' framing.
- **Whitespace levels (1-8)** scale the photos inside the fixed layout (level 1 fills
  the region, 8 is airiest); they never re-group.
- **Title** is edited in the page header and shown centered on the page.
- **Caption** is edited inline under each photo.
- **Page rail** (right side, wide screens) shows a faithful thumbnail of every cover
  and page; drag a content-page thumbnail to reorder pages (covers stay fixed), or
  click one to scroll to that page. Thumbnails reuse the layout engine, so they never
  crop either.
