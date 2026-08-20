# Plan 019 — Decorative photo frames

## Implementation steps

1. **Types** — `src/types.ts`: add `Photo.frame? / frameColor? / frameText? / frameWidth? /
   frameFocus?`.
2. **Pure catalog** — `src/lib/frames.ts` (no rounded corners):
   - `FrameStyle = { id; name; square; hasText; defaultColor }`. `FRAMES`: `polaroid`
     (`square`, `hasText`), `border` (uniform, selectable width).
   - `FrameColor = { id; name; value; ink }`. `FRAME_COLORS`: white, black, kraft, blush,
     sage, navy. `BORDER_WIDTHS` (Thin default / Medium / Thick).
   - `frameById`, `isFrame`, `frameColorOf`, `borderWidthOf`, `frameInner(style, w, h, width)`
     (Polaroid = square window; Border = uniform inset), `squareCrop(sourceRatio, focus)` (the
     Polaroid's pixel-square cover region), `frameLayoutRatio` / `photoLayoutRatio` (the outer
     ratio the engine sizes a framed cell to; Polaroid fixed, Border = photo + border).
3. **Catalog tests** — `src/lib/frames.test.ts` per the Test Plan.
4. **Store** — `src/store.ts`: `setPhotoFrame` (validates; clearing drops note / width /
   focus), `setPhotoFrameColor`, `setPhotoFrameText`, `setPhotoFrameWidth`, `setPhotoFrameFocus`.
5. **Font asset** — add `src/assets/Caveat.ttf`; `@font-face { font-family: "Caveat"; ... }`
   in `src/index.css`; a `.font-hand` helper (Caveat then a cursive fallback).
6. **Component** — `src/components/FramedPhoto.tsx`: draw the mat (bg color, soft shadow, no
   rounding); Polaroid renders a `CroppedImg` of `squareCrop(sourceRatio, focus)` in the
   square window; Border contains the photo (its effective ratio) in `frameInner`; the note
   sits in the bottom band (`.font-hand`, the color's `ink`). Used by `Paper.tsx` and
   `PreviewPaper.tsx` (page leaf); the small page-rail `Thumb` is left unframed in v1. The
   engine sites feed `photoLayoutRatio(photo)`.
7. **Picker + pan** — `src/components/PageCard.tsx`: a "Frame" popover (None + style swatches,
   a color row, then a note input for Polaroid or a Thin/Medium/Thick width for Border). In
   `Paper.tsx`, Shift-drag on a Polaroid pans its focus (`setPhotoFrameFocus`); add
   `frame`/`color`/`text`/`width`/`focus` to the layout `frameKey`.
8. **Print** — `src/lib/pdf-export.ts`: register `@pdf-lib/fontkit` and embed the bundled font
   once per interior build; for a framed photo fill the mat, then for a Polaroid draw the
   square window from `squareCrop` and for a Border contain the photo, and draw the note in
   the embedded font. Thread the frame fields (incl. `photoRatio` / `sourceRatio`) through
   `ExportPageLike.items` and `ExportPanel.tsx`.

## Test Plan

| Module | Scenario                                            | Expected                                          |
| ------ | --------------------------------------------------- | ------------------------------------------------- |
| frames | catalog + palette integrity                         | ids unique / non-empty; pads in 0..1; colors set  |
| frames | `frameById` / `isFrame` known vs unknown            | shape or undefined; true/false                    |
| frames | `frameColorOf` unknown id                        | returns the fallback                              |
| frames | `frameInner` keeps the inner box inside the frame   | inner x/y >= 0, inner right/bottom <= w/h         |
| frames | `frameInner` bottom band (hasText) leaves room      | inner bottom < h - (b - t) * w (a real band)      |
| store  | `setPhotoFrame` known id / null (clears note)       | frame set; null clears frame and frameText        |
| store  | `setPhotoFrame` unknown id                          | frame cleared (never persisted)                   |
| store  | `setPhotoFrameColor` / `setPhotoFrameText`          | set on the target photo only                      |

The layout engine is not touched, so there is no new ratio/fit assertion in the engine; the
frame is not an input to `computeLayout`. `frameInner` is unit-tested to keep the photo box
inside the frame (a "fit, no overflow" check for the mat). The in-app pass (Phase 5) confirms
the framed photo is whole and undistorted and that None restores the plain photo.

## Tasks

- [x] 1 Types: frame / frameColor / frameText
- [x] 2 Pure `frames.ts` catalog + palette + `frameInner`
- [x] 3 `frames.test.ts`
- [x] 4 Store actions (+ store test)
- [x] 5 Font asset + @font-face + .font-hand
- [x] 6 FramedPhoto + render surfaces
- [x] 7 PageCard Frame picker (+ Paper frameKey)
- [x] 8 Print: frame + inset photo + embedded-font note
- [x] 9 Validate + verify in-app + docs
