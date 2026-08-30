# 042 - Cover text above or below the photo

## Context

A cover face draws its title and subtitle in a band at the top and contains the photo in the
area below it. The band is FIXED: 20% of the face width with a subtitle, 15% with a title
alone, 6% (the plain margin) with no text at all. Its height depends only on whether text is
present, never on the font size, so enlarging a title never shrinks the photo and a
subtitle-less cover gives that space back (specs 003, 036, 041).

That top position is hard-coded in the four places that draw a cover face: `CoverCard` (the
editor), `PreviewPaper` (the book preview), `coverPanel` in `print.ts` (the PDF geometry, used
both by the cover wrap and by an inside cover face printed in the interior file), and the CSS
mirror each of the first two carries.

A photographer whose cover photo carries its subject high in the frame, or a sky that reads
better under a horizon, wants the title under the picture instead. Today the only way is to
leave the cover text-only and add the title as a note (spec 039), which loses the album's
title styling and its spine link. Issue #120.

## Goals

- A per-face choice: the text block sits **above** the photo (today's behaviour, the default)
  or **below** it.
- The choice is an exact mirror. The band keeps the same three heights, the text block keeps
  its reading order (title, then subtitle), and the photo keeps the whole area on the other
  side of the band.
- The editor, the book preview and the exported PDF agree, as they already do for the top
  band.
- Every one of the four faces carries its own choice: front, inside front, inside back, back.

## Non-goals

- **Interior pages are out of scope.** A page's band is derived from its text (spec 036), not
  fixed, and it shares the page with captions under the photos; mirroring it is a separate
  design. Issue #120 asks for the cover.
- No free placement of the title (that is what a note is for, spec 039).
- No change to `computeLayout`, to any ratio, or to the whitespace levels.
- No new text styling: size, font and colour keep coming from the album theme.

## Requirements

1. **Data model**: `Cover` gains `textPosition?: "top" | "bottom"`. Absent means `"top"`, so
   every existing project reads exactly as it does today. A stored value that is neither is
   coerced to `"top"` on load, like every other coerced field (`coverOrDefault`).
2. **Geometry (the mirror)**, in `coverPanel`, for a band of height `B` and a margin `M`:
   - `top` (today): the text block starts `M` below the face's top edge; the photo area is
     `[B, trimH - M]`.
   - `bottom`: the text block ENDS `M` above the face's bottom edge; the photo area is
     `[M, trimH - B]`.
   `B` and `M` are unchanged in both directions, so the two layouts are the same composition
   flipped, and a face with no text at all is unaffected (its band is the plain margin).
3. **The photo never changes.** It is still sized by `computeLayout` with a single slot inside
   the area, so `w / h` stays the photo's ratio to the pixel. Only the area's origin moves.
4. **The editor** offers the choice in the cover card toolbar, next to the whitespace control:
   a two-state control, "Title at the top" / "Title under the photo", showing which is active.
   Editing a face still coalesces into one undo step per field (spec 037); switching the
   position is its own step.
5. **The book preview** (`PreviewPaper` cover leaf) and the **PDF** (`coverPanel`, so both the
   cover wrap and an inside cover face printed in the interior file) follow the same rule.
6. **The export** carries the field: `ExportCoverFace` and the inside-cover `ExportPageLike`
   both reach `coverPanel` through the export mapping.
7. **Persistence**: the field round-trips through `ProjectDoc`, a project bundle (spec 021) and
   `duplicateDoc`, and a document saved before this feature loads as `"top"`.
8. **Copy** is translated, EN and FR (spec 032).

## Acceptance criteria

- [x] A cover face with a title, a subtitle and a photo, set to `bottom`, draws the photo from
      the top margin down to the band and the text block in the band, subtitle last.
- [x] The band heights are identical in both positions (20% / 15% / 6% of the face width).
- [x] The photo's `w / h` equals its ratio in both positions, and the photo fits inside its
      area (no overflow, no clip).
- [x] A face with no text at all renders identically in both positions.
- [x] The editor, the book preview and the exported PDF place the text on the same side.
- [x] An inside cover face printed in the interior file honours the choice.
- [x] A project saved before this feature opens with every face at `top`; a stored value that
      is neither `top` nor `bottom` loads as `top`.
- [x] Duplicating a project keeps each face's choice.
- [x] The control is translated in EN and FR.

## Edge cases

| Case                                   | Expected                                                        |
| -------------------------------------- | --------------------------------------------------------------- |
| No title, no subtitle                   | Band is the plain margin; both positions render the same        |
| Subtitle but no title                   | Band is the subtitle band; the block sits in it, on its side    |
| No photo                                | The text block moves; the empty drop area takes the rest        |
| A panorama on a `bottom` cover          | Contained in the area, ratio exact, whitespace absorbs the rest |
| A tall portrait on a `bottom` cover     | Same: the area is the mirror of the top one, never a crop       |
| A note (spec 039) placed on the face    | Notes are absolute over the face, unaffected by the position    |

## Architecture

The choice is one field read by one geometry function and mirrored by two CSS renderers.

```
Cover.textPosition  ──► coverPanel (print.ts)  ──► cover wrap PDF + inside cover page PDF
                    ├──► CoverCard   (editor CSS: band at top or bottom)
                    └──► PreviewPaper (book preview CSS, same mirror)
```

Files changed:

- `src/types.ts` - `CoverTextPosition`, `Cover.textPosition`.
- `src/lib/project.ts` - `coverOrDefault` coerces the value.
- `src/lib/cover-layout.ts` (new, pure) - the band height and the two areas, shared by the
  print geometry and read by the components for their CSS. One source of truth for the mirror.
- `src/lib/print.ts` - `coverPanel`, `CoverFaceInput`, `InsideCoverPageInput`.
- `src/lib/pdf-export.ts` - `ExportCoverFace`, `ExportPageLike` carry the field.
- `src/components/ExportPanel.tsx` - passes it for the four faces.
- `src/components/CoverCard.tsx` - the mirror plus the toolbar control.
- `src/components/PreviewPaper.tsx`, `src/components/BookPreview.tsx` - the preview mirror.
- `src/lib/i18n.ts` - EN and FR copy.
