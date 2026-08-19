# 011 - In-app book preview

## Context

Today a project is edited page by page (`Paper`, `CoverCard`) and exported to a
print-ready PDF (`print.ts` / `pdf-export.ts`). There is no way to read the whole book
end to end inside the app the way it will bind and print. The roadmap's first requested
item is an **in-app book preview**: a read-through of the entire book, distinct from the
editor and from the PDF, reusing the same pure engine numbers as `Paper` / `Thumb` /
`print.ts`.

## Goals

- A full-screen, read-only preview that reads the whole book in **double-page spreads**
  (open-book), maximizing the available screen space.
- Fast navigation via a **thumbnail rail** on the right (every cover and page in booklet
  order), plus keyboard and on-screen prev/next.
- Faithful to what prints: same layout engine, same margins/text scales, every photo
  contain-fit. Covers included in booklet order (front, inside front, pages, inside
  back, back).

## Non-goals

- No editing inside the preview (no drag, no caption edit, no controls). It is a viewer.
- No engine change, no data-model change. This is a presentation layer over existing
  state.
- No page-turn animation or physical page-curl effect (out of scope; a later polish).
- No print/PDF changes.

## The one rule (no crop)

The preview is read-only and reuses `computeLayout` exactly as `Paper`/`Thumb`/`print.ts`
do, so every photo stays contain-fit and keeps its native ratio. The only new geometry
is **how large to draw a spread so it fills the screen** (`fitSpread`), which sizes the
page box while preserving the page aspect ratio; the photo boxes inside it come straight
from the unchanged engine. No path crops, clips, or non-proportionally resizes a photo.

## Requirements

1. A **Preview** button in the top bar (near Export), enabled only when the project has
   at least one photo. It opens a full-screen overlay.
2. The overlay presents the book as **spreads**:
   - Linear booklet order of leaves: `front`, `inside front`, `page 1..N`,
     `inside back`, `back`.
   - The front cover is a single (recto) leaf; the remaining leaves pair as
     `(verso, recto)`: `(inside front, page 1)`, `(page 2, page 3)`, ... The final leaf
     is a single if the count is odd (e.g. the back cover closing alone).
   - Each spread is drawn as large as possible within the available stage area
     (`fitSpread`), both pages sharing the book's aspect ratio. The two pages are
     presented as an open book: joined at the spine with a gutter (binding) shadow and a
     drop shadow under the book; a single leaf (cover) reads as a standalone card.
3. A **thumbnail rail** on the right lists every leaf in booklet order (reusing `Thumb`).
   Clicking a leaf jumps to the spread that contains it. The leaves in the current spread
   are highlighted.
4. Navigation: on-screen prev/next controls, `ArrowLeft`/`ArrowRight` to turn spreads,
   `Escape` to close, click on the dimmed backdrop to close. A spread label/counter is
   shown (e.g. "Front cover" / "Pages 2-3" / "2 / 7").
5. Each leaf renders faithfully:
   - **Page**: title + subtitle header and per-photo captions positioned exactly as
     `Paper` (same margin/top-offset/text-scale formulas), photos placed by
     `computeLayout` with the page's `layoutId` and `whitespace`.
   - **Cover**: title + subtitle and one optional contained photo (single-slot), mirroring
     `CoverCard`.
   - An empty page renders as a blank paper (faithful to a blank printed page), with no
     editor placeholder text.
6. Preview view state (open flag, current spread index) is **ephemeral UI state** local to
   the preview owner, not album state; the store is untouched.

## Architecture

New pure helper module + one overlay component; nothing else changes shape.

```
TopBar
  -> Preview button (local open state)
    -> BookPreview (overlay, reads store: pages, photos, covers, bookSize)
        bookLeaves(...)         [PURE] linear booklet order of leaves
        toSpreads(leaves)       [PURE] cover-single then (verso,recto) pairing
        fitSpread(avail, A, n)  [PURE] page px size maximizing the stage, ratio kept
          -> PreviewPaper (read-only faithful render of one leaf; reuses computeLayout)
          -> Thumb (existing) in the right rail for quick nav
```

Files:

- `src/lib/preview.ts` (new, PURE): `Leaf` type, `bookLeaves`, `toSpreads`, `fitSpread`.
- `src/lib/preview.test.ts` (new): order, pairing, and sizing (ratio + fit) tests.
- `src/components/BookPreview.tsx` (new): the overlay (stage measuring, spread render,
  rail, keyboard/pointer nav).
- `src/components/PreviewPaper.tsx` (new): read-only faithful render of one leaf.
- `src/components/TopBar.tsx` (edit): add the Preview button + local overlay state.

No changes to `src/types.ts`, `src/store.ts`, or `src/lib/layout.ts`.

## Acceptance criteria

- [x] Preview button appears in the top bar, disabled when there are no photos, opens the
      overlay when clicked.
- [x] The overlay shows the book in double-page spreads in correct booklet order (front
      single, then verso/recto pairs, back closing).
- [x] Each spread is drawn maximizing the available space; both pages keep the book
      aspect ratio (no distortion).
- [x] The right rail lists every leaf; clicking one jumps to its spread; the current
      spread is highlighted.
- [x] Prev/next buttons, Left/Right arrows, Escape, and backdrop click all work.
- [x] Page leaves show title/subtitle/captions like `Paper`; cover leaves show
      title/subtitle + contained photo like `CoverCard`; empty pages are blank.
- [x] No photo is cropped or distorted in any spread (portrait, landscape, panorama, 1-6
      photos).
- [x] `npm run validate` passes (typecheck + lint + tests).

## Edge cases

- **No photos**: button disabled; overlay not reachable.
- **Only the default empty page** (photos exist but a page is empty): that page renders
  blank; navigation still works.
- **Odd leaf count**: the last spread is a single leaf, centered.
- **Panorama / portrait / mixed**: engine contains each photo; `fitSpread` keeps the page
  ratio, so nothing is clipped.
- **Very small viewport**: `fitSpread` shrinks the spread to fit height or width,
  whichever binds; the rail is scrollable.
- **Cover text-only / photo-only**: renders text alone or photo alone, both contained.
