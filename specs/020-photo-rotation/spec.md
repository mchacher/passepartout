# Spec 020 — Decorative photo rotation

## Context

The photographer wants to give a photo a small decorative TILT (like a photo dropped on a
scrapbook page), rotating it by a few degrees in fixed steps. Unlike crop / mask, a
rotation shows the WHOLE photo and never changes its aspect ratio; it is purely a visual
transform on top of the layout the engine already chose.

## The one rule (respected)

The founding rule is "a photo's aspect ratio is never changed and a photo is never
clipped." A rotation keeps the entire photo at its native ratio and only tilts it, so the
rule holds directly. The layout engine is not touched: it still lays out the un-rotated box
(ratio preserved), and the tilt is applied as a visual transform (a CSS `rotate` on screen,
a rotated draw in the PDF), composing with a frame (the whole framed unit tilts).

The only edge is geometric, not a crop: a tilted photo's corner can extend past its cell
into the surrounding whitespace, and a large tilt on a photo that fills its cell (little
whitespace) can reach the page edge (clipped by the page boundary, like any overflow). The
rotation itself never crops the photo content.

## Goals

- A per-photo decorative rotation in fixed steps of 5 and 10 degrees, within a decorative
  range (about +/- 30 degrees). Default is 0 (no tilt).
- The tilt shows everywhere the photo is placed (editor, book preview) and in the exported
  PDF, and composes with a frame (the framed photo tilts as one unit).

## Non-goals

- No free-angle rotation and no 90-degree orientation fix (that is a different, corrective
  feature); this is a small decorative tilt in fixed steps.
- No auto-scaling to keep a tilted photo inside its cell; the tilt is purely visual and may
  extend into the whitespace (the decorative scrapbook look).
- The small page-rail thumbnail shows the photo un-tilted in v1 (a nav aid), like frames.

## Data model

- `Photo.rotation?: number` — the tilt in degrees (a multiple of the step, within range),
  or absent for no tilt (0). Positive tilts clockwise.
- New pure helper `src/lib/rotation.ts`: `ROTATION_MAX`, `ROTATION_STEPS` (`[5, 10]`),
  `clampRotation(deg)` (clamp to `[-MAX, MAX]`, non-finite -> 0).

## Architecture

Flow: `store.setPhotoRotation(photoId, deg)` writes `Photo.rotation` -> `CroppedImg` and
`FramedPhoto` apply `transform: rotate(deg)` on their root (rotate about the center) ->
the PDF painter draws the photo / frame rotated about the box center. The engine and
`computeLayout` are untouched (rotation is not one of its inputs).

Files changed:

- `src/types.ts`: `Photo.rotation?: number`.
- `src/lib/rotation.ts` (new, pure) + `src/lib/rotation.test.ts`.
- `src/store.ts`: `setPhotoRotation(photoId, deg)` (clamped).
- `src/components/CroppedImg.tsx`, `FramedPhoto.tsx`: a `rotation?` prop applying the CSS transform.
- `src/components/Paper.tsx`, `PreviewPaper.tsx`: thread `photo.rotation`.
- `src/components/PageCard.tsx`: a "Tilt" control in the Edit-layout toolbar (-10 / -5 / +5 / +10 / reset).
- `src/lib/pdf-export.ts`: draw the photo (and a framed unit) rotated about the box center.

## Requirements

1. In "Edit layout", the selected photo can be tilted by +/- 5 and +/- 10 degrees and reset
   to 0, within the decorative range.
2. The tilt is a whole-photo rotation: the aspect ratio is unchanged and the photo is not
   cropped or distorted.
3. The tilt renders in the editor, the book preview, and the exported PDF, and composes with
   a frame (the framed unit tilts as one).
4. An un-tilted photo (rotation 0 or absent) is unchanged.

## Acceptance criteria

- [x] The Edit-layout toolbar offers a Tilt control with -10 / -5 / +5 / +10 and a reset,
      showing the current angle.
- [x] Tilting a photo rotates it about its center; a portrait stays a portrait, undistorted,
      whole (no crop), only tilted.
- [x] The tilt is clamped to the decorative range and stays a multiple of the step.
- [x] The same tilt shows in the book preview and the exported PDF.
- [x] A tilt composes with a frame (a tilted Polaroid tilts as one unit, note included).
- [x] Reset returns the photo to level (0 degrees).

## Edge cases

- Rotation 0 / absent: no transform, identical to before.
- A tilt near the page edge or on a full-bleed (whitespace 1) photo may reach the page
  boundary; the overflow is clipped by the page, not by a crop of the photo.
- Rotation composes with crop (spec 015), mask (018) and frame (019): the transform wraps
  the already-composed photo/frame.
- A stored rotation outside the range (corrupt value): clamped on read/use.

## Follow-ups

- **#5 - the caption tilts with the photo**: a photo's caption rotates together with the
  photo (and any frame) as one unit, about the photo center, in the editor, the preview, and
  the exported PDF. Previously the caption stayed level below the tilted photo.
- **#3 - clear straighten control**: the Tilt popover shows the current angle as a plain
  readout and offers a dedicated "Straighten" (reset to 0) button, disabled when already
  level. Previously the current angle doubled as the reset button, so it was unclear where to
  click to level the photo.
