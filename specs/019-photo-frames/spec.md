# Spec 019 — Decorative photo frames

## Context

Beyond the crop (015) and mask (018) tools, the photographer wants to dress a photo in a
decorative **frame**: a Polaroid (white border, thick bottom, room for a handwritten note)
or a simple colored border. Unlike a mask, a frame is **additive**: it draws a border and
background AROUND the photo, so the photo is shown whole. This is the most no-crop-friendly
decoration yet: the photo is never clipped, only matted.

## The one rule (per style)

The founding rule is "a photo's aspect ratio is never changed and a photo is never
clipped." The two frame styles relate to it differently, and neither ever distorts:

- **Border** is ADDITIVE: the photo is contained whole inside a uniform border of a
  selectable width (thin by default). Nothing is clipped; the rule holds directly.
- **Polaroid** shows the photo in a SQUARE window: the photo is cover-cropped to the square
  (an opt-in clip, like the full-page Fill and the crop tool) and can be panned with a focus
  (Shift-drag) to choose which part shows. No mask/rounding; a thick bottom band holds a note.

Either way the aspect ratio is preserved (never stretched). The engine is not changed; it is
only fed the frame's OUTER ratio (`frameLayoutRatio`) so a framed cell is sized to the frame,
then the frame is drawn inside that box.

## Goals

- An enrichable catalog of frame styles (geometry) plus a palette of frame colors. Starter
  styles: Polaroid (thick bottom band, holds a note) and Border (uniform border). Starter
  colors: white, black, kraft, blush, sage, navy.
- A photo can opt in to one frame style and pick its color. A frame with a text band
  (Polaroid) can carry an optional short handwritten note.
- The note renders in a real handwriting font on screen AND in the exported PDF (a bundled,
  self-hosted font embedded into the PDF), so print matches the screen.
- The frame shows everywhere the photo is placed (editor, page rail, book preview) and in
  the PDF. The photo is contained inside the frame, never clipped.

## Non-goals

- No frame on the cover faces or a full-page photo (like crop/mask, frames are offered in
  the page "Edit layout" flow only).
- No arbitrary color picker in v1; colors come from the palette (enrichable by an entry).
- No multi-line rich text; the note is a single short line.
- The small page-rail thumbnails (a nav aid) show the contained photo without the mat in
  v1; the frame renders in the editor, the book preview spread and the PDF.
- The frame does not change the engine's box ratio (it adapts to the photo's box, like a
  mask). A "true Polaroid square" that reshapes the layout box is out of scope.

## Data model

- `Photo.frame?: string` — frame style id from the catalog, or absent for no frame.
- `Photo.frameColor?: string` — color id from the palette; absent = the style's default.
- `Photo.frameText?: string` — the handwritten note, only rendered by a style with a text
  band. Absent / empty = no note.
- `Photo.frameWidth?: number` — the Border's border width (fraction of the box width); absent
  = the thin default.
- `Photo.frameFocus?: CropFocus` — the Polaroid's pan focus for its square window; absent =
  centered.
- New pure catalog `src/lib/frames.ts`:
  - `FrameStyle = { id; name; pad: { t; r; b; l }; radius; hasText; defaultColor }` where
    the pads and radius are fractions of the box WIDTH (so the border keeps a consistent
    thickness at any size). `FRAMES: FrameStyle[]`; `frameById`, `isFrame`.
  - `FrameColor = { id; name; value; ink }` (physical colors, theme-independent; `ink` is
    the note's text color on that frame). `FRAME_COLORS`; `frameColorOf(id, fallbackId)`.
  - `frameInner(style, w, h)` -> `{ x, y, w, h }`: the photo area inside the border, in px.

## Architecture

Flow: `store.setPhotoFrame / setPhotoFrameColor / setPhotoFrameText` write the three fields
-> the placement renders (`Paper`, `PreviewPaper` page leaf) render a new `FramedPhoto`
(frame background + shadow + the contained `CroppedImg` in the inner area + the note in the
handwriting font) when `photo.frame` is set, else the plain `CroppedImg` -> the PDF painter
draws the frame rectangle, the inset photo, and the note (using an embedded copy of the
bundled handwriting font via `@pdf-lib/fontkit`).

Font: a self-hosted handwriting font (Caveat, OFL) is added under `src/assets`, declared
`@font-face` in `src/index.css` for screen, and embedded into the interior PDF for the note.

Files changed:

- `src/types.ts`: `Photo.frame? / frameColor? / frameText?`.
- `src/lib/frames.ts` (new, pure) + `src/lib/frames.test.ts`.
- `src/store.ts`: `setPhotoFrame`, `setPhotoFrameColor`, `setPhotoFrameText` (validated).
- `src/components/FramedPhoto.tsx` (new): the on-screen frame + contained photo + note.
- `src/components/Paper.tsx`, `PreviewPaper.tsx` (page leaf): render `FramedPhoto` when framed.
- `src/components/PageCard.tsx`: a "Frame" control (None + styles, color swatches, note input).
- `src/lib/pdf-export.ts`: draw the frame + inset photo + note; register fontkit + embed the font.
- `src/assets/Caveat.ttf`, `src/index.css` (@font-face), `package.json` (@pdf-lib/fontkit).

## Requirements

1. A frame catalog and a color palette live in one file; adding a style or color is one entry.
2. In "Edit layout", the selected photo can be given a frame style, a color, and (for a
   style with a text band) a short note, or set back to None.
3. The photo is contained inside the frame and never clipped or distorted; its aspect ratio
   is unchanged.
4. The note renders in a handwriting font on screen and in the exported PDF (embedded font).
5. The frame renders in the editor, the book preview spread, and the PDF (the small page-rail
   thumbnails show the contained photo without the mat in v1).
6. An un-framed photo is unchanged (no frame).

## Acceptance criteria

- [x] The Edit-layout toolbar offers a Frame control: None + styles, a color row, and a note
      input shown only for a style with a text band.
- [x] Applying "Polaroid" shows the photo in a square window over a thick bottom band, with
      no rounded corners; the photo is cover-cropped to the square (undistorted) and can be
      panned with Shift-drag.
- [x] Applying "Border" mats the photo whole (contained, never clipped) in a uniform border
      with no rounded corners; the width is selectable (Thin / Medium / Thick), thin by default.
- [x] Changing the color recolors the frame; the note text stays legible (its ink adapts).
- [x] Typing a note shows it in a handwriting font in the bottom band.
- [x] Setting the frame to None restores the plain photo.
- [x] The framed photo (and note) show in the book preview spread.
- [x] The exported interior PDF shows the frame, the contained photo, and the note in the
      embedded handwriting font.
- [x] Adding a new entry to `FRAMES` or `FRAME_COLORS` makes it appear in the picker.

## Edge cases

- Unknown / stale frame or color id: treated as no frame / the default color.
- A note on a non-text style: ignored (not rendered).
- Panorama / portrait: the frame adapts to the photo's box; the photo stays contained.
- Frame + mask (spec 018): compose (the contained photo is masked inside the frame).
- Empty note: no text band content, just the frame.
- The handwriting font fails to load: screen falls back to a cursive stack; the PDF still
  embeds the bundled font.
