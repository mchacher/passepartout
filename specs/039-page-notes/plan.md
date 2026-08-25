# Plan 039 - Notes on the page

## Implementation steps

1. **Fonts** - `src/assets/fonts/`: one latin subset `.ttf` per face (14 files, 34 to 61 kB
   each) plus one `OFL.txt` per family. Caveat stays where it is and is reused.
   `src/index.css`: an `@font-face` per face pointing at the same file the PDF embeds, plus
   the `.note-type` rule that disables kerning and ligatures.

2. **Types** - `src/types.ts`: `Note`, `NoteAlign`, `NoteTarget`, `notes?: Note[]` on
   `AlbumPage` and on `Cover`, and the note defaults.

3. **Pure lib** - `src/lib/note-fonts.ts`: the six family catalog, `noteFontById`,
   `noteFontFace(id, {bold, italic})`, `hasItalic(id)`, the css stack and the asset url per
   face.

4. **Pure lib** - `src/lib/notes.ts`: `NOTE_SIZES`, `noteFontSize`, `NOTE_TRACKING`,
   `wrapLines`, `measureTracked`, `clampNote`, `snapNotePlacement`, `noteInk`, `newNote`,
   `coerceNotes`.

5. **Lib tests** - `src/lib/notes.test.ts` and `src/lib/note-fonts.test.ts` per the Test Plan.

6. **Store** - `src/store.ts`: `addNote`, `updateNote` (coalesced), `deleteNote`, targeting a
   page or a cover face. `src/lib/project.ts`: `coerceNotes` on load, fresh note ids on
   duplicate.

7. **View state** - `src/viewStore.ts`: the selected note `{ key, id, editing }`, cleared on
   project switch and when arrange mode opens.

8. **Components**:
   - `src/components/NoteLayer.tsx`: the single renderer. Read only by default; interactive
     (select, drag, width handle, inline text editing) when given a target.
   - `src/components/NoteControls.tsx`: the note toolbar (font, N/I/B, size, ink, align,
     caps, rule, opacity, tilt, delete), shared by the page and the cover surfaces.
   - `Paper.tsx`, `CoverCard.tsx`: render the layer, host the "Note" button and the toolbar.
   - `Thumb.tsx`, `PreviewPaper.tsx`: render the layer read only.
   - `PageCard.tsx`: the "Note" button and the toolbar slot.

9. **i18n** - `src/lib/i18n.ts`: the new keys in `en` and `fr` (the parity test enforces it).

10. **Print** - `src/lib/print.ts`: `NotePlace`, `notePlaces(notes, trim, scales)`, added to
    `interiorPageGeometry`, `insideCoverPageGeometry` and `coverWrapGeometry`.

11. **Export** - `src/lib/pdf-export.ts`: embed only the faces used, wrap with the embedded
    metrics, draw the reserve, the lines (character by character when tracking is on), the
    rule, all rotated about the note centre. Thread `notes` through `ExportPanel`.

12. **Docs** - fold the essential shape into `docs/architecture.md` (data model, the new
    pure modules, the extension point) and add the feature to `docs/overview.md` and the
    `README.md` list.

## Test Plan

| Module     | Scenario                                                        | Expected                                                        |
| ---------- | --------------------------------------------------------------- | --------------------------------------------------------------- |
| notes      | `wrapLines` on a phrase narrower than the box                    | one line, unchanged                                              |
| notes      | `wrapLines` on a phrase wider than the box                       | greedy split, every line within the width, no word lost          |
| notes      | `wrapLines` with explicit line breaks                            | breaks always honoured, each segment wrapped independently       |
| notes      | `wrapLines` with a single word wider than the box                | that word alone on its line, never split                         |
| notes      | `wrapLines` on empty or whitespace-only text                     | no lines                                                         |
| notes      | `noteFontSize` at each level                                     | the documented fraction of the page width, monotonic             |
| notes      | `measureTracked` with tracking                                   | base width plus tracking after every character (the CSS rule)    |
| notes      | `clampNote` on a note dragged past an edge                       | the box stays fully inside the page, `w` unchanged               |
| notes      | `clampNote` on a width beyond the allowed range                  | clamped to `[0.08, 1]`                                           |
| notes      | `clampNote` on a tilt beyond the decorative range                | clamped to plus or minus `ROTATION_MAX`                          |
| notes      | `snapNotePlacement` near the centre, a margin, a third           | snapped to that guide; free between the snap zones               |
| notes      | `noteInk` for each id, and for `custom`                          | the album palette value, or the custom hex                       |
| notes      | `coerceNotes` on an unknown font / size / ink / align            | coerced to the defaults, the note kept                           |
| notes      | `coerceNotes` on a malformed entry (no id, no text field)        | dropped, the rest kept                                           |
| note-fonts | every family resolves a face for every bold / italic combination | a real shipped face, never a synthesized one                     |
| note-fonts | a family with no italic asked for italic                         | falls back to its regular or bold face, `hasItalic` reports false |
| note-fonts | every face in the catalog                                        | has a non-empty asset url and a css stack                        |
| store      | `addNote` on a page and on a cover face                          | one note at the centre with the defaults, its id returned        |
| store      | `updateNote` on one note                                         | only that note changes; the other pages and covers untouched     |
| store      | `deleteNote`                                                     | removed from that container only                                 |
| store      | a note never touches `photoIds`, `layoutId` or `placement`       | the page's photo state is byte for byte identical                |
| project    | serialize then hydrate a project holding notes                   | every note round-trips, on pages and on covers                   |
| project    | duplicate a project holding notes                                | notes preserved, every note id fresh                             |
| bundle     | export then import a project holding notes                       | every note preserved                                             |
| print      | a page with one note                                             | a `NotePlace` centred at the right point, size in pt, tilt kept  |
| print      | a note on a cover face                                           | placed from the trim box of that face                            |
| print      | an empty note                                                    | no `NotePlace` emitted                                           |
| print      | a page with notes                                                | the photo boxes are identical to the same page without notes     |
| layout     | (regression) ratio preservation and containment                  | unchanged; `src/lib/layout.ts` is not modified by this spec      |

## Verification in the real app (Phase 5)

Driven with Playwright on the built app, both themes:

1. Add a note on an interior page, type into it, drag it into the whitespace, check that
   every photo box is unchanged before and after (measured, not eyeballed).
2. Set each font, italic, bold, each size, each ink, caps, rule, opacity, reserve, tilt.
3. Drag the width handle and confirm the wrap point moves.
4. Add a note on a cover face.
5. Undo and redo a move, an edit and a delete.
6. Reload the page and confirm the notes came back from IndexedDB.
7. Export the PDF and confirm the notes are painted where the editor showed them.
