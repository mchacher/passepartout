# Overview

## The one rule

A photo's aspect ratio is never changed and the photo is never clipped. The layout
engine may only pick a photo's **size** and the **whitespace** around it. This rule
is enforced in code (`src/lib/layout.ts` returns cells whose `w/h` always equals the
photo's `ratio`) and guarded by tests (`src/lib/layout.test.ts`).

## Data model

- **Photo** (`src/types.ts`): one imported image. Holds its native size, `ratio`,
  `caption`, capture `time`, and which page it sits on (`pageId`, or `null` when it is
  still in the library).
- **AlbumPage**: an ordered list of photo ids plus an optional `title`.
- **PageFormat**: `square | landscape | portrait`, mapped to an aspect ratio.

All state and every mutation live in the Zustand store (`src/store.ts`). Components
never mutate state directly; they call store actions.

## The reactive flow

```
Import / demo
  -> store.photos (sorted by capture time)
    -> store.pages (auto-distributed, DEFAULT_PER_PAGE per page)
      -> PageCard controls (title, count 1-4, delete)
        -> Paper measures its content box in pixels
          -> computeLayout(items, w, h, density)  [pure]
            -> centered rows, ratios intact, whitespace around
```

## The layout engine

`computeLayout(items, contentW, contentH, { density })`:

1. Pick a target row height from `density` (more whitespace -> smaller).
2. Greedily pack photos into rows by width at that height.
3. Scale the whole block down if any row is too wide or the stack is too tall, so
   nothing overflows the page. Never scale up: whitespace is a feature.
4. Rows are **centered**, not justified to full width. That is what produces the
   gallery look instead of edge-to-edge fills.

Because the engine is pure and returns plain numbers, the same function will later
paint a 300 DPI PDF page: same math, different canvas.

## Interaction

- **Drag** a photo from the Library onto a page to place it; drag it back to the
  Library (or use the hover `×`) to remove it.
- **Count buttons (1-4)** grow the page by pulling the next unplaced photos in
  chronological order, or shrink it by returning the last ones to the Library.
- **Title** is edited in the page header and shown centered on the page.
- **Caption** is edited inline under each photo.
