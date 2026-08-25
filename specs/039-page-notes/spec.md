# 039 - Notes on the page

## Context

An album page can carry a title and a subtitle, both centered in a fixed band at the top,
and a photo can carry a caption under it. That is all the text there is, and its position
is decided by the app, not by the user.

What is missing is the small, freely placed word: a date in the whitespace between two rows,
a place name in the margin, a line written across a full page photo. In a printed photo book
that text is what turns a set of pictures into a story, and its placement is a compositional
choice, not a fixed slot.

This spec adds a **note**: a small block of text that belongs to a page (or to a cover face),
not to a photo. It is placed by dragging, tilted like a photo, and typed directly on the
paper. It has its own font, weight, style, size, ink and a small set of typographic
treatments.

A visual proposal was reviewed and approved before this spec: three placement situations
(in the whitespace, in the margin at an angle, over a photo), six font voices, four
treatments, and the ink palette.

## The one rule

Untouched. A note is an **overlay**. It never enters `computeLayout`, never changes a
photo's box, its ratio or the page's whitespace, and no photo is clipped, moved or resized
because a note exists. Photos are laid out exactly as they are today; notes are painted on
top afterwards, on screen, in the preview and in the PDF.

## Goals

- A **note** on any interior page and on **all four cover faces**.
- **Free placement**: drag it anywhere on the page, whitespace or over a photo, with soft
  magnetism toward the page centre, the margins and the thirds.
- **A width handle** that decides where the text wraps, so a note can be tucked into a
  column of whitespace.
- **Six shipped font families**, so the note prints exactly as previewed, line breaks
  included. This is the point issue #99 raises about album fonts: a system font cannot be
  embedded in a PDF, so a font only prints exactly if the app ships its file.
- **Regular / italic / bold**, five size steps, four album inks plus a free color.
- **Four typographic treatments**: spaced small caps, a hairline rule above or below,
  three opacity steps, and a paper reserve behind the text for legibility over a photo.
- **A decorative tilt**, the same range and steps as a photo (spec 020): 5 degree steps
  within plus or minus 30.
- The same note renders identically in the editor, the page rail thumbnails, the book
  preview and the exported PDF.

## Non-goals

- **No rich text inside a note.** One font, one weight, one style, one ink per note. Two
  looks means two notes.
- No text flowing around photos, no columns, no lists, no hyphenation.
- No free rotation by handle: the tilt is by 5 degree steps from the toolbar, like a photo.
- No note on the spine.
- No change to the album's own font catalog. Whether the album text stops being substituted
  at print is issue #99, decided separately; this spec only ships the note font catalog,
  which that decision can later reuse.
- No engine change. `src/lib/layout.ts` is not modified.

## Requirements

### Data model

`src/types.ts` gains a `Note`:

```ts
export interface Note {
  id: string;                    // crypto.randomUUID()
  text: string;                  // may hold explicit line breaks
  // Placement, normalized to the page so it is resolution independent and identical
  // on screen, in the preview and in print. x/y are the note box's CENTRE.
  x: number;                     // 0..1 of the page width
  y: number;                     // 0..1 of the page height
  w: number;                     // 0..1 of the page width: the wrapping width
  rotation?: number;             // decorative tilt in degrees, absent = level
  font: NoteFontId;              // one of the six shipped families
  size: NoteSizeLevel;           // one of five steps, a fraction of the page width
  bold?: boolean;
  italic?: boolean;
  align: NoteAlign;              // "left" | "center" | "right"
  ink: NoteInkId;                // "ink" | "inkSoft" | "accent" | "paper" | "custom"
  customInk?: string;            // hex, only meaningful when ink === "custom"
  caps?: boolean;                // uppercase + tracking
  rule?: "over" | "under";       // hairline rule, absent = none
  opacity?: number;              // 0.6 | 0.3, absent = fully opaque
  cartouche?: boolean;           // paper reserve behind the text
}
```

- `AlbumPage` gains `notes?: Note[]`.
- `Cover` gains `notes?: Note[]`.
- Absent or empty means no note, so every existing project is unchanged.

A `NoteTarget` names where a note lives: `{ kind: "page"; pageId }` or
`{ kind: "cover"; face: CoverFace }`. It is serialized nowhere; it only addresses a store
action and the current selection.

### The font catalog (`src/lib/note-fonts.ts`, pure)

Six families, each an id, a display name, a CSS stack and one shipped file per face:

| id          | name            | voice             | faces                    |
| ----------- | --------------- | ----------------- | ------------------------ |
| `garamond`  | EB Garamond     | book serif        | regular, italic, bold    |
| `playfair`  | Playfair Display| display serif     | regular, italic, bold    |
| `lato`      | Lato            | quiet sans        | regular, italic, bold    |
| `quicksand` | Quicksand       | rounded           | regular, bold            |
| `courier`   | Courier Prime   | typewriter        | regular, italic, bold    |
| `caveat`    | Caveat          | handwriting       | regular, bold            |

- All six are OFL licensed. Each family ships its license file next to the font, the way
  `src/assets/Caveat-OFL.txt` already does.
- One `.ttf` per face, latin subset, 34 to 61 kB. The **same file** is declared by
  `@font-face` for the screen and embedded by `@pdf-lib/fontkit` in the PDF, exactly as
  Caveat already is, so metrics are identical by construction. A face is only downloaded
  when a note actually uses it.
- Caveat is already in the repository and is reused as is.
- `quicksand` and `caveat` have no italic face: the italic control is disabled for them.
- `noteFontFace(id, { bold, italic })` resolves a family plus a style to one face, falling
  back to the nearest available face rather than synthesizing one.

### Geometry (`src/lib/notes.ts`, pure)

- `NOTE_SIZES`: five levels as a fraction of the page width,
  `xs 0.016, sm 0.022, md 0.030, lg 0.042, xl 0.058`. The band runs from a caption to a
  title, so a note can whisper or carry a page.
- `noteFontSize(level, pageW)` returns the size in the caller's unit (px on screen, pt in
  print), so the same call serves every surface.
- `NOTE_TRACKING = 0.2` em, applied only when `caps` is set, after every character, which is
  what CSS `letter-spacing` does.
- `wrapLines(text, maxWidth, measure)`: pure greedy wrap. Explicit line breaks are always
  honoured; a word wider than the box is kept whole on its own line and is allowed to
  overflow rather than being hyphenated or broken.
- `clampNote(note, hFrac)` keeps a note usable: `w` within `[0.08, 1]`, the box fully inside
  the page on both axes given its measured height fraction, rotation clamped by
  `clampRotation` (spec 020), opacity within the allowed set.
- `snapNotePlacement(x, y, threshold)`: soft magnetism toward `0.5`, the page margins and
  the thirds, exactly in the spirit of `snapAnchor` in `grid-edit.ts`.
- `noteInk(ink, customInk, palette)` resolves an ink id against the album palette, so the
  note follows the album style.

**Line breaks must be identical on screen and in print.** The same `wrapLines` runs on both
surfaces; only the measurement differs (a canvas 2d context on screen, `widthOfTextAtSize` in
the painter). Both read the same font file. Kerning and ligatures are disabled for notes
(`font-kerning: none`, `font-variant-ligatures: none`, `ctx.fontKerning = "none"`) because
pdf-lib neither measures nor draws kerned text: turning them off on screen is what makes the
two agree exactly.

### Store (`src/store.ts`)

- `addNote(target)` creates a note at the page centre with the defaults
  (`font: "garamond"`, `size: "sm"`, `align: "center"`, `ink: "ink"`, `w: 0.5`) and returns
  its id so the caller can select it.
- `updateNote(target, id, patch)` merges a patch, coalescing consecutive edits of the same
  fields into one undo step (the `updateCover` pattern), so a drag or a burst of typing is
  one step.
- `deleteNote(target, id)`.
- Undo and redo need no work: `pages` and the four covers are already document keys watched
  by the history wrapper (spec 037).

### Selection (`src/viewStore.ts`)

The selected note is ephemeral view state, like the arrange mode: `note: { key, id, editing }`
where `key` is `page:<pageId>` or `cover:<face>`. Only one note is ever selected. Opening
another project, entering arrange mode or deleting the note clears it.

### Interaction

- **Add**: a "Note" button in the page toolbar (`PageCard`) and in each cover card toolbar.
  The new note lands at the page centre, selected and in text editing.
- **Select**: click a note. A selected note wears a dashed outline and a width handle.
- **Move**: drag it. Magnetism as above. One drag is one undo step.
- **Width**: drag the handle on the right edge; the note keeps its centre and grows
  symmetrically, so a centered note stays centered.
- **Edit the text**: double click, or start typing right after adding. Escape or a click
  outside leaves editing and keeps the note selected.
- **Delete**: the toolbar control, or Backspace / Delete while selected and not editing.
- Notes are **not interactive while the page is in arrange mode** (spec 038 owns the surface
  there), but they are still drawn.

### The note toolbar

Appears under the page when a note is selected, in the same place and style as the photo
toolbar: font, N / I / B, size, ink (four swatches, a free color, and the paper reserve
toggle), align, caps, rule, opacity, tilt minus and plus, delete.

All copy goes through `t()` in both catalogs (spec 032).

### Rendering

One read-only renderer, `src/components/NoteLayer.tsx`, takes the notes and the page box in
pixels and paints them. `Paper` and `CoverCard` pass a target as well, which turns the same
layer interactive. `Thumb` and `PreviewPaper` use it read only. There is exactly one place
that turns a `Note` into a box.

### Print (`src/lib/print.ts` + `src/lib/pdf-export.ts`)

- `PageGeometry` and `CoverGeometry` gain `notes: NotePlace[]`, computed in points from the
  **trim** box, so a note sits at the same place on paper as on screen.
- The painter embeds only the faces actually used, wraps with `wrapLines` and the embedded
  font's metrics, draws the paper reserve first, then each line (character by character when
  `caps` adds tracking, since pdf-lib has no letter spacing), then the hairline rule, the
  whole block rotated about its centre by the existing rotation helper (spec 020).
- An empty note is skipped.

### Persistence and migration

`notes` travels inside `AlbumPage` and `Cover`, so `serializeProject`, the IndexedDB adapter
and the project bundle carry it with no change. On load, `coerceNotes` drops a malformed note
and coerces an unknown font, size, ink or align to the default, the way `coverOrDefault` and
`textSizesOrDefault` already do. Duplicating a project gives every note a fresh id.

## Acceptance criteria

- [x] A note can be added, moved, resized, typed into, tilted and deleted on an interior page.
- [x] The same is true on all four cover faces.
- [x] A note can sit in the whitespace, in the margin, or over a photo, and dragging it never
      changes a single photo's position, size or ratio.
- [x] Font, regular / italic / bold, five sizes, four inks plus a free color, three
      alignments, small caps, rule, opacity and paper reserve all apply and persist.
- [x] The italic control is disabled for the two families that have no italic face.
- [x] A note renders identically in the editor, the page rail, the book preview and the PDF,
      with the same line breaks.
- [x] Undo restores a moved, edited or deleted note; a drag and a burst of typing are each
      one step.
- [x] A project saved before this feature opens unchanged, with no notes.
- [x] A project bundle exported and re-imported keeps every note.
- [x] `npm run validate` is green and `src/lib/layout.ts` is untouched.

## Edge cases

| Case                                   | Behaviour                                                        |
| -------------------------------------- | ---------------------------------------------------------------- |
| Empty text                              | placeholder in the editor, skipped in the preview and the PDF     |
| A word wider than the box               | kept whole on its own line, allowed to overflow, never hyphenated |
| Dragged to the edge                     | the box is clamped to stay fully inside the page                  |
| A page with no photo                    | notes work; the page is just paper                                |
| A full page photo (spec 012)            | notes draw on top of it, which is the "over the photo" situation  |
| A page in arrange mode (spec 038)       | notes are drawn but not interactive                               |
| An unknown font or size id on load      | coerced to the default, the note is kept                          |
| A note on a cover face and the cover rework (#97) | `notes` sits on `Cover` beside `photoId`, so it survives  |
