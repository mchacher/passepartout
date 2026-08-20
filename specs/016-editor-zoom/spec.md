# Spec 016 — Editor zoom

## Context

The page cards in the central editing column render fairly small (the column is
capped at `max-w-[620px]`). Precise editing (move / resize / crop a photo in the
"Edit layout" mode) is harder than it needs to be at that size. The photographer
wants a way to enlarge the pages while keeping the two side columns (the Library on
the left and the thumbnail rail on the right) at their current size.

## Goals

- A zoom control, anchored bottom-right of the editing area, that scales the central
  column of cards up and down.
- The left Library column and the right thumbnail rail keep their fixed size and
  position; only the central column changes.
- The zoom level is an ephemeral view preference (not album data), persisted to
  `localStorage` so it survives a refresh, like the existing grid toggle.

## Non-goals

- No change to the layout engine, the data model, or the PDF export. Zoom is a pure
  display scale of the editing column.
- No zoom of the read-only book preview, the covers thumbnails, or the print output.
- No per-page zoom; it is a single global editor preference.

## The one rule

Zoom only changes the pixel width the central column renders at. Each page still
lays out through the pure `computeLayout` (contain-fit) at that width, so every photo
keeps its aspect ratio and nothing is cropped — a larger column simply means larger
photos with the same framing. There is no engine change, so the invariant is
untouched by construction.

## Requirements

1. A zoom slider (with a magnifier icon and a percentage readout) floats at the
   bottom-right of the editing column, clear of the thumbnail rail.
2. Moving the slider scales the width of the central cards container between a minimum
   and a maximum around the current 620px baseline (100% = today's size).
3. The scaled width never exceeds the available width of the central column, so the
   layout never overflows horizontally; on a narrow window zoom is naturally bounded.
4. The Library column and the thumbnail rail are visually unchanged at every zoom
   level.
5. The chosen zoom persists across a page refresh (localStorage), and a
   storage failure degrades gracefully (zoom still works in memory).
6. Photos remain contain-fit and never cropped or distorted at any zoom level.

## Architecture

Flow: `viewStore.zoom` (ephemeral, persisted) → `App.tsx` applies it as the central
container's width → `Paper` / `CoverCard` re-measure via their `ResizeObserver` and
ask the pure engine to place photos at the new size.

Files changed:

- `src/lib/zoom.ts` (new, pure): `ZOOM_MIN`, `ZOOM_MAX`, `ZOOM_STEP`, `ZOOM_DEFAULT`,
  `BASE_WIDTH_PX`, `clampZoom(z)`, `zoomWidthPx(z)`.
- `src/lib/zoom.test.ts` (new): unit tests for the pure helpers.
- `src/viewStore.ts`: add `zoom` + `setZoom`, persisted to localStorage.
- `src/components/ZoomControl.tsx` (new): the floating slider.
- `src/App.tsx`: apply the zoom width to the central container and mount the control.

## Acceptance criteria

- [x] A zoom slider is visible at the bottom-right of the editing area with a percentage.
- [x] Dragging it enlarges / shrinks the page cards in the central column.
- [x] The Library and the thumbnail rail do not move or change size while zooming.
- [x] The layout never overflows horizontally; the scaled width is bounded by the column.
- [x] The zoom level survives a refresh.
- [x] At maximum zoom, a portrait stays portrait and a panorama stays panorama, with no
      crop or distortion (visually confirmed).

## Edge cases

- No photos: the empty state has no cards; the control may be hidden (nothing to zoom).
- Very narrow window (single-column layout under 760px): zoom is bounded by the column
  width, so it stays usable and never overflows.
- Storage disabled / throws: reads fall back to the default; writes are swallowed.
- A persisted zoom outside the valid range (corrupt value): clamped on read.
