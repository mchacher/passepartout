# 036 - Page header band derived from the text sizes

## Context

A content page draws its header (title, optional subtitle) in a band at the top, and the
photo area starts below it. Today that band is a constant fraction of the page width:
`12.5%` with a subtitle, `10%` with a title alone, `5%` with neither
(`Paper.tsx`, `PreviewPaper.tsx`, and `TOP_TITLE` / `TOP_SUBTITLE` in `print.ts`).

The text inside the band is not constant. Since spec 006 every text role carries a size
level: `sm` 0.85, `md` 1, `lg` 1.2, `xl` 1.45. The band ignores it, so the clearance
between the header and the first photo drifts with the chosen sizes. At `md` it is already
gone: the subtitle's line box ends at about `14.2%` of the page width while the photo area
starts at `12.5%`, which is why the subtitle looks glued to the photos (issue 67). At `xl`
the text runs further into the photo area; at `sm` a band of dead space sits above it.

Two more defects come with it:

- The gap between title and subtitle is `mt-[1%]`, a fraction of the header box width. It is
  unrelated to the subtitle's own size and reads as too wide next to the (absent) clearance
  below.
- The rule is written three times and the copies disagree: the editor and the book preview
  space the subtitle by `mt-[1%]`, the PDF export by `title.sizePt * 1.2`.

### The decision this reverses

The fixed band was deliberate. `print.ts` states it for the cover faces: the band "depends
only on whether a title / subtitle is present, never on the font-size level, so enlarging
the title no longer shrinks the photo". Spec 006 likewise promised "no change to photo
geometry" when it added the size levels.

Issue 67 asks for the opposite trade: a margin that holds "quelles que soient les tailles".
Both cannot be true. A band that guarantees clearance must grow with the text, so a larger
title does take room from the photos. This spec chooses the guaranteed clearance for
content pages, and says so out loud. Cover faces keep the fixed band (see Non-goals).

## Goals

- One pure geometry rule for the content-page header, shared by the editor, the book
  preview and the PDF export.
- A clearance below the header that is the same at every size level.
- A tighter title-to-subtitle gap, proportional to the subtitle size.
- Preview equals print by construction: one function, three call sites, no constant kept in
  sync by hand.

## Non-goals

- **Cover faces are out of scope.** `COVER_TOP_TITLE` / `COVER_TOP_SUBTITLE` keep their
  fixed bands: cover margins are far larger (6% to 20%), so the collision this fixes does
  not occur there, and cover photo geometry stays independent of the text size. The
  divergence is intentional and noted here so the next reader does not "fix" it by accident.
- No measuring of rendered text. Print has no DOM; measuring on screen would break
  preview / print parity. The rule assumes one line for the title and one for the subtitle.
- No new user-facing control. Nothing is added to the Style menu.
- No layout-engine change. `computeLayout` is untouched.

## The one rule

Untouched. The band only changes the size of the content box handed to the engine. Every
photo is still contain-fit at its native ratio inside its region: a shorter content box
means slightly smaller photos, never a crop and never a non-proportional resize.

## Requirements

### R1 - The rule

The band is built from, in order:

| Part            | Value                                        |
| --------------- | -------------------------------------------- |
| top inset       | `0.054` of page HEIGHT (unchanged)           |
| title line      | `LINE * 0.031 * titleScale` of page width    |
| gap             | `GAP_FRAC * 0.022 * subtitleScale` of width  |
| subtitle line   | `LINE * 0.022 * subtitleScale` of width      |
| clearance       | `CLEARANCE` of page width, a constant        |

`0.031` and `0.022` are the existing page title / subtitle font fractions (`F_PAGE_TITLE`,
`F_PAGE_SUBTITLE`, mirrored on screen by `3.1cqw` / `2.2cqw`). `LINE` is the line-box factor
the header renders with, set explicitly on both lines so the model and the DOM agree.

Absent parts drop out: a page with a title only has no gap and no subtitle line; a page with
neither keeps the plain `5%` margin on all four sides.

### R2 - Constant clearance

For a given book size, the distance between the bottom of the last text line and the top of
the content box is identical at `sm`, `md`, `lg` and `xl`, and identical whether the page has
a title alone or a title and a subtitle.

### R3 - Tighter title-to-subtitle gap

The gap is proportional to the subtitle size and visibly smaller than today's `mt-[1%]`
at `md`.

### R4 - One implementation

`Paper.tsx` (editor), `PreviewPaper.tsx` (book preview) and `print.ts` (PDF) all derive the
band and the subtitle offset from the same pure function. No duplicated numeric constant
remains in the components.

### R6 - One text size, no readability clamp

The page title and subtitle were drawn on screen through `clamp(13px, 3.1cqw, 19px)` and
`clamp(10px, 2.2cqw, 14px)`, while print used the raw fraction. The clamp was active at nearly
every editor width, so the on-screen title was smaller, relative to the page, than the printed
one, and a band derived from it would drift with the zoom level. The clamp is removed: both
lines are the pure fraction of the page width on every surface.

### R5 - Accepted consequence

At `md` with a title and a subtitle the band grows from `12.5%` to about `14.7%` of the page
width, so the photo area starts slightly lower than before. This is the cost of R2 and is
accepted. Albums with no page text are pixel-identical.

Removing the clamp (R6) also makes page titles look bigger in the editor than they used to,
because that is the size they have always printed at. The PDF output does not change from
this: only the on-screen preview becomes faithful to it.

## Acceptance criteria

- [x] The band follows the text: it grows from `sm` to `xl`, for a title alone and for a
      title with a subtitle.
- [x] The clearance under the last text line is the same at every size level (R2).
- [x] The title-to-subtitle gap at `md` is smaller than today's `0.86%` of page width (R3).
- [x] A page with no title and no subtitle keeps a `5%` margin on all sides, unchanged.
- [x] The editor, the book preview and the exported PDF place the header and the content box
      identically at every size level (R4).
- [x] The band is the same fraction of the page at every on-screen width, so zooming the
      editor scales the composition instead of changing it (R6).
- [x] Photos keep their native ratio everywhere; nothing is clipped.
- [x] Non-square book sizes (portrait 8x10, landscape 13x11) behave: the top inset stays a
      fraction of the height, the rest a fraction of the width.

## Edge cases

| Case                                   | Expected                                                   |
| -------------------------------------- | ---------------------------------------------------------- |
| No title, no subtitle                  | `5%` margin all round, band unchanged from today            |
| Subtitle but no title                  | Subtitle sits where the title would, no gap, same clearance |
| `xl` title + `xl` subtitle             | Band grows; clearance identical to `sm`; no overlap         |
| `sm` title + `sm` subtitle             | Band shrinks; photos get the space back                     |
| Full-page photo (spec 012)             | No header at all; untouched                                 |
| Long title that wraps                  | Known limit: the second line eats the clearance, as today   |
| Portrait 8x10 / landscape 13x11        | Top inset from height, text and clearance from width        |
