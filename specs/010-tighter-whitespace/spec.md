# 010 - Larger photos (tighter whitespace)

## Context

The album's "blancs assumes" are deliberate, but photos still read too small: even at
the tightest whitespace level a lot of the page is white. The owner wants photos to
fill more of the page. This tunes the three shared whitespace levers so photos are
bigger everywhere (editor, thumbnails, and the exported PDF, since they share the pure
engine), without ever cropping.

## Goals

- **Photos maximized by default**: a fresh page fills its regions to the contain-fit
  (no surrounding fill-fraction white), so out of the box photos are as large as no-crop
  allows.
- Noticeably larger photos across every whitespace level, keeping the ratio invariant.
- The change flows through the one engine, so the on-screen page, the rail thumbnails,
  and the print PDF all get bigger photos consistently (preview == print).

## Non-goals

- No crop, no ratio change, no filling a region of a different aspect (contain-fit
  letterboxing stays; that is the product). Only the *amount of surrounding white*
  shrinks.
- No new whitespace model or per-photo sizing (that is free placement, a separate item).
- No cover-layout redesign; covers get bigger photos for free via the shared engine.

## The one rule

Central and preserved. Every lever here only reduces surrounding whitespace; the photo
box is still `boxW = boxH * ratio` and never exceeds its region's contain-fit
(`fill <= 1`), so nothing is cropped, clipped, or distorted. The engine tests assert
ratio preservation and no-overflow at the new values.

## Requirements

Three shared levers, all ratio-preserving:

1. **Fill fraction floor** (`src/lib/layout.ts`): raise the minimum fill so even airy
   levels are less empty. `fill = 0.5 + 0.5 * density/100` becomes
   `fill = 0.6 + 0.4 * density/100`. The maximum is still `1.0` (contain-fit) at the
   tightest level, so a photo is never scaled past no-crop; only the airy end grows.
2. **Inter-region gap** (`src/lib/layout.ts`): the structural gap between sibling regions
   shrinks from `max(6, min(w,h) * 0.03)` to `max(4, min(w,h) * 0.02)`, so multi-photo
   pages pack tighter.
3. **Page margin** (`src/components/Paper.tsx` and `src/lib/print.ts`, kept in sync so
   preview == print): the page content margin shrinks from `7%` to `5%` of the page
   width, and the title / subtitle top offsets from `13% / 16%` to `11% / 14%`.

**Maximize photos by default.** Set the default whitespace level for a fresh page (and a
fresh cover) to the tightest, `1` (was `4`), in `DEFAULT_WHITESPACE` (`src/types.ts`), so
a new page fills its regions to the contain-fit (fill 1.0) out of the box. The slider
still lets a user add whitespace per page. Existing pages keep their saved level.

## Acceptance criteria

- [x] A fresh page/cover maximizes its photos by default (whitespace level 1, fill 1.0).
- [x] Photos are visibly larger at the same whitespace level, on the page, in the rail
      thumbnails, and in the exported PDF.
- [x] No photo is cropped, distorted, or non-proportionally resized; a portrait stays
      portrait and a panorama stays a panorama.
- [x] At the tightest whitespace level a photo fills its region's constraining dimension
      (fill 1.0); at the airiest it is larger than before (fill 0.6, not 0.5).
- [x] Multi-photo pages sit closer together (smaller gap) without overlapping.
- [x] The preview still matches the print (margins changed in both `Paper` and
      `print.ts`).
- [x] `computeLayout` stays ratio-preserving; existing engine tests plus the new
      fill-floor/fit tests pass.

## Edge cases

- **Single photo, airiest level**: bigger than before but still surrounded by white
  (fill 0.6), letterboxed on its non-constraining dimension (no crop).
- **Panorama / tall portrait**: contain-fit inside its region, never clipped, just with
  less margin around it.
- **Dense multi-photo page**: tighter gap must not cause regions or photos to overlap.
- **Title / subtitle present**: the reduced top offset must still clear the photos.
