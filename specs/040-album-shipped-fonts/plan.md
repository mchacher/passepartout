# Plan 040 - Album fonts that reach the PDF

## Implementation steps

1. **Fonts** - add `cabin-regular.ttf`, `cabin-italic.ttf`, `cabin-bold.ttf` and `cabin-OFL.txt`
   to `src/assets/fonts/`. Delete `src/assets/Caveat.ttf` and `src/assets/Caveat-OFL.txt`
   (superseded by the two static Caveat faces already shipped).

2. **Pure lib** - rename `src/lib/note-fonts.ts` to `src/lib/fonts.ts` and generalise the names
   (`ShippedFontId`, `SHIPPED_FONTS`, `shippedFontById`, `shippedFontFace`, `allShippedFaces`);
   add the `cabin` family. Values are untouched: they are persisted in notes.

3. **CSS** - `src/index.css`: the note-font block becomes the shipped-font block, `"Caveat Note"`
   becomes `"Caveat"`, the old variable-file `@font-face` goes, and `.font-hand` points at the
   shipped family. Add the three Cabin faces.

4. **Album catalog** - `src/lib/themes.ts`: `FontTheme` names a shipped `family` instead of
   carrying a stack; the five ids are remapped and `display` + `hand` are added. Keep
   `fontThemeOrDefault` and `DEFAULT_FONT_THEME` as they are.

5. **Theme vars** - `src/lib/theme-vars.ts`: `--album-font` resolves through the shipped catalog.

6. **Lib tests** - `themes.test.ts`, `fonts.test.ts`, `theme-vars.test.ts` per the Test Plan.

7. **Print** - `src/lib/print.ts`: `fontFamilyForTheme` becomes `albumFontFamily(fontTheme):
   ShippedFontId`.

8. **Export** - `src/lib/pdf-export.ts`: embed the album face from its shipped file (sharing the
   on-demand embedding the notes already use), drop `standardFont` and the standard families,
   drop `winAnsiSafe` from album text, and draw the Polaroid note with the shipped Caveat.
   Delete `src/lib/winansi.ts` and its test if nothing uses them any more.

9. **i18n** - `font.display` and `font.hand` in `en` and `fr` (the parity test enforces it).

10. **Docs** - `docs/architecture.md` (the album theme entry, the module map, the extension
    point), `docs/overview.md`, `README.md`, and `CLAUDE.md` roadmap item 2, which this closes.

## Test Plan

| Module | Scenario | Expected |
| --- | --- | --- |
| fonts | every family resolves a real face for every bold/italic combination | a shipped face, never a synthesized one |
| fonts | `cabin` is in the catalog with three faces | regular, italic and bold all present |
| fonts | every face has a non-empty asset url | true (the PDF embeds that file) |
| themes | seven font themes, unique ids | true |
| themes | every font theme names a family that exists in the shipped catalog | true, so no album text can be substituted |
| themes | the five historical ids still resolve | `serif`, `sans`, `humanist`, `rounded`, `typewriter` all present |
| themes | `fontThemeOrDefault` on an unknown or missing id | `serif`, as before |
| theme-vars | `--album-font` for each theme | the shipped family's stack, containing its real family name |
| print | `albumFontFamily` for each of the seven ids | the mapped shipped family id |
| print | (regression) geometry is unchanged by the font | header band and photo boxes identical for two font themes at the same text sizes |
| layout | (regression) ratio preservation and containment | unchanged; `src/lib/layout.ts` is not modified |

## Verification in the real app (Phase 5)

Driven with Playwright on the built app:

1. Open the Style menu, confirm seven styles, each label rendered in its own typeface.
2. Switch the album to each style and confirm the page and cover text change face on screen.
3. Export the interior and the cover wrap, then run `pdffonts` on both: the album's shipped
   face must be listed as embedded, and Times / Helvetica / Courier must not appear at all.
4. Type a cover title with a typographic apostrophe and an accented capital, export, and read
   it back in the rendered PDF.
5. A Polaroid frame note still prints in Caveat.
6. A note (spec 039) still prints exactly as before the rename.
