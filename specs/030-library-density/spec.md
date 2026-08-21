# 030 - Library thumbnail density

## Context

The Library is a fixed 2-column strip of thumbnails. With ~200 photos it is cramped, and
grouping by date does not help when the photos are all from the same day/event. A density
control works regardless of capture dates.

## Goal

Let the user pick how many columns the Library thumbnails use, so they can scan many photos
(more, smaller thumbnails) or see detail (fewer, larger). The choice persists.

## Non-goals

- No change to the layout engine or album data (Library is a browsing tray).
- No date grouping / search (possible later; this is the universal, simple win).

## Requirements

1. A small **density control** in the Library (2 / 3 / 4 columns), next to the "Unused only"
   filter.
2. The thumbnail grid uses the chosen column count; the choice is **persisted** (localStorage,
   in `viewStore` alongside zoom / grid), defaulting to 2.
3. Thumbnails stay square and undistorted; the usage badge and drag-and-drop are unchanged.

## Acceptance criteria

- [x] The Library shows a 2/3/4-column control; picking one re-lays the thumbnails at that
      column count.
- [x] The choice survives a refresh.
- [x] Thumbnails remain square/undistorted; badges and drag/drop still work; empty states span
      the full width.

## Edge cases

- **Invalid/absent stored value**: falls back to the default (2 columns).
- **Very few photos**: the control still works; the grid just has empty tracks.
