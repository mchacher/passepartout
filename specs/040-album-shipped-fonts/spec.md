# 040 - Album fonts that reach the PDF

Issue: #99

## Context

The album text you see is not the text that prints. A project picks a `fontTheme` whose value
is a **system font stack** (`src/lib/themes.ts`): Georgia, Optima, SF Pro Rounded, Rockwell.
A PDF cannot embed a system font, so the export falls back to one of the three standard PDF
families:

```
fontFamilyForTheme(fontTheme)   // print.ts: serif | sans | mono
standardFont(family)            // pdf-export.ts: TimesRoman | Helvetica | Courier
```

Three of the five album fonts collapse onto Helvetica, so Humanist and Rounded do not exist
at all in a printed book, and the metrics differ from the preview, so a title that sits on one
line on screen can wrap on paper.

Spec 039 solved exactly this problem for notes, by shipping the font file and embedding it,
which is the only way a font prints exactly. Five of the six families it ships are already the
voices the album catalog needs. This spec finishes the job: the album adopts the shipped
catalog, and the substitution disappears from the product.

## The one rule

Untouched. Fonts change what text looks like, never a photo's box, its ratio or the page
whitespace. `src/lib/layout.ts` is not modified. The one geometric consequence is intended
and already modelled: the page header band is derived from the text size (spec 036), never
from the typeface, so switching families does not move a photo.

## Goals

- **Every album font is a shipped file**, declared by `@font-face` for the screen and embedded
  in the PDF from the same file, exactly as spec 039 does for notes. No substitution anywhere.
- **Seven album styles** instead of five, since two more shipped families are already here.
- **One shipped font catalog** in the code (`src/lib/fonts.ts`), used by the album and by the
  notes, instead of a system catalog beside a shipped one.
- **The Polaroid handwriting note** (spec 019) uses that catalog too, which removes the
  duplicate Caveat file spec 039 left behind (a 400 kB variable file beside two static faces).
- Album text stops being restricted to WinAnsi in the PDF: an embedded font carries the
  characters people actually type.

## Non-goals

- No bold or italic **control** for album text. This spec makes them possible in the PDF (three
  faces per family are embedded on demand); offering the user a choice is another spec.
- No change to the note feature's behaviour, only to where its catalog lives.
- No data migration: the `fontTheme` ids are unchanged, so every stored project keeps its value.
- No new text role, no change to the size levels (spec 006), no engine change.

## Requirements

### The shipped catalog (`src/lib/fonts.ts`, pure)

`src/lib/note-fonts.ts` is renamed and generalised, since it is no longer about notes:

| old | new |
| --- | --- |
| `note-fonts.ts` | `fonts.ts` |
| `NoteFontId` | `ShippedFontId` |
| `NOTE_FONTS` | `SHIPPED_FONTS` |
| `noteFontById` | `shippedFontById` |
| `noteFontFace` | `shippedFontFace` |
| `allNoteFaces` | `allShippedFaces` |

The **values** are untouched (`"garamond"`, `"lato"`, ...), because they are persisted in every
note. One family is added:

| id | name | voice | faces |
| --- | --- | --- | --- |
| `cabin` | Cabin | humanist sans | regular, italic, bold |

Cabin is OFL, in the Gill Sans / Optima lineage, which is the voice the current Humanist stack
was reaching for.

### The album catalog (`src/lib/themes.ts`)

A `FontTheme` stops carrying a raw CSS stack and names a shipped family instead:

```ts
export interface FontTheme {
  id: FontThemeId;
  /** The shipped family this style is set in (src/lib/fonts.ts). */
  family: ShippedFontId;
}
```

`FontThemeId` keeps its five values and gains two:

| id | family | note |
| --- | --- | --- |
| `serif` | `garamond` | was Georgia |
| `sans` | `lato` | was system-ui |
| `humanist` | `cabin` | was Optima |
| `rounded` | `quicksand` | was SF Pro Rounded |
| `typewriter` | `courier` | was Rockwell |
| `display` | `playfair` | new |
| `hand` | `caveat` | new |

The display name comes from the shipped catalog, and the picker's label keeps coming from the
i18n catalog by id (`font.<id>`), so the two new ids need their two keys in `en` and `fr`.
`fontThemeOrDefault` is unchanged: an unknown id still falls back to `serif`.

### Print (`src/lib/print.ts` + `src/lib/pdf-export.ts`)

- `fontFamilyForTheme` (serif / sans / mono) is replaced by `albumFontFamily(fontTheme):
  ShippedFontId`. `standardFont` and the three standard PDF families are deleted.
- The painter embeds the album's regular face from its shipped file, on demand and subset,
  the way it already embeds a note face.
- `winAnsiSafe` is no longer applied to album text: the embedded font is not WinAnsi encoded,
  so restricting the characters would drop glyphs the user typed for no reason.
- The Polaroid note is drawn with the shipped Caveat regular; `src/assets/Caveat.ttf` and its
  `@font-face` are removed, and the CSS family `"Caveat Note"` becomes plain `"Caveat"`.

### The screen

`theme-vars.ts` keeps emitting `--album-font`; its value now comes from the shipped family's
CSS stack. Nothing else in the components changes: they all read that variable.

## Acceptance criteria

- [x] The album style picker offers seven styles, each rendered in its own real typeface.
- [x] An exported interior PDF embeds the album's shipped font and no standard PDF family:
      `pdffonts` reports the embedded face, never Times, Helvetica or Courier.
- [x] The same holds for the cover wrap, including the spine text.
- [x] A project saved before this change opens with the same `fontTheme` id and prints in that
      style's shipped font.
- [x] A cover title holding a typographic apostrophe or an accented capital prints it.
- [x] Notes still behave exactly as spec 039 shipped them, through the renamed catalog.
- [x] The Polaroid handwriting note still prints in Caveat, from the single remaining file.
- [x] `npm run validate` is green and `src/lib/layout.ts` is untouched.

## Edge cases

| Case | Behaviour |
| --- | --- |
| A stored `fontTheme` id that no longer exists | `fontThemeOrDefault` returns `serif`, as today |
| A face that cannot be fetched at export time | that text is skipped, the rest of the PDF still builds |
| An album set to `hand` with a long title | prints in Caveat; no size clamp is added by this spec |
| A note using the same family as the album | one embedded face is shared, not embedded twice |
