# Spec 032: Internationalization (i18n) with a French translation

## Context

The whole UI is written in inline English strings across ~27 components plus a handful of pure
catalogs in `src/lib/`. The primary audience is French. This spec adds a translation layer and a
complete French translation of the UI chrome, with English kept as the source and default.

Album **content** (project name, page titles, subtitles, captions, spine, frame notes) is whatever
the user types and is never translated. This spec is about the interface chrome only. Written
source (code, docs, commits) stays English per repo convention; this adds a runtime UI translation,
it does not translate the source.

## Goals

- A small, dependency-free i18n layer (no react-i18next): a pure catalog + a `t()` lookup with
  interpolation and simple pluralization.
- A **complete** French translation of every user-facing string: inline component strings, the
  auth/admin/update surfaces, and the catalog display names (layouts, fonts, colors, book sizes,
  masks, frames, papers, text roles).
- A language selector, reachable everywhere (top bar in the app, and on the Setup/Login screens
  before sign-in). Choice persisted; default inferred from the browser locale.
- Server-surfaced error messages shown to the user are rendered from client-side translations for
  the known cases, so a French user does not see stray English. The server itself stays English
  internally (no API change).

## Non-goals

- No third-party i18n library, no ICU message format, no runtime language downloads.
- No translation of album content or of source code/docs.
- No server/API localization (client-side messages only).
- No new languages beyond `en` and `fr` (the layer is built so a third can be added later, but
  none is added now).
- The layout engine is untouched: this feature changes text only, never photo geometry.

## Requirements

1. **`src/lib/i18n.ts` (pure)**: `Lang = "en" | "fr"`, `LANGS`, `DEFAULT_LANG = "en"`,
   `detectLang(navigatorLang?): Lang` (`fr*` locale -> `fr`, else `en`), a `messages` catalog with
   an `en` and a `fr` map, `translate(lang, key, params?)` (interpolates `{name}` placeholders;
   falls back `fr -> en -> key`), and `plural(lang, count, forms)` with correct English and French
   rules (French: 0 and 1 are singular).
2. **Catalog names**: the `en` values for catalog display names are derived from the existing pure
   `src/lib/*` catalogs (layouts/themes/book-sizes/masks/frames/print papers/text roles) so English
   is not duplicated; `fr` provides an override per id. i18n may import those pure catalogs (all
   pure lib, no boundary broken).
3. **Language preference**: add `lang` to `src/viewStore.ts` (ephemeral view pref, localStorage key
   `pp.lang`, default `detectLang(navigator.language)`), with `setLang`. This is the single source
   of the active language.
4. **`useT()` hook** (`src/useT.ts` or exported from the i18n module): subscribes to `viewStore.lang`
   and returns a bound `t(key, params?)` so every consuming component re-renders on a language
   change.
5. **Coverage**: every inline user-facing string, aria-label, title, placeholder and alt-of-chrome
   in `src/components/*` and `src/App.tsx` is rendered through `t()`. Album-data text (captions,
   titles the user typed) stays raw.
6. **Catalog rendering**: components that render catalog `name`/`label` (ThemeMenu, SizeMenu,
   PageCard, ExportPanel, BookPreview, etc.) render them through `t()` keyed by the catalog id, with
   the lib label as the ultimate fallback.
7. **Pluralization / interpolation**: strings like `Used N times`, `N unused / total`,
   `Tilt left N degrees`, `Whitespace level X of Y`, `Signed in as {user}`, `Updating to {version}`
   use `t()` params / `plural()`, never English string concatenation.
8. **Server-surfaced errors**: Setup, Login, UsersPanel, UpdatesSheet and ProjectMenu(import) show
   a client-side translated message for the known failures (wrong credentials, username taken,
   password too short, could not add/change, bundle-invalid, update could not start), falling back
   to a translated generic message. `src/lib/bundle.ts` `BundleError`s are mapped to translation
   keys by a stable `code` (add a `code` to `BundleError`) rather than by matching English text.
9. **Language selector**: a `LanguageMenu` in the top bar (always present, local and server mode)
   and a compact language toggle on the Setup and Login screens.
10. **Document language**: an effect sets `document.documentElement.lang` to the active language.
11. **CSS placeholder**: the empty-caption hint currently hardcoded in `src/index.css`
    (`content: "Add a caption"`) is driven by a CSS variable (`--caption-placeholder`) that the
    language effect sets, so it translates without leaving CSS.

## Acceptance criteria

- [x] Switching the language flips every chrome string (top bar, page controls, library, covers,
      export, theme/size menus, preview, crop editor, spine, rail, zoom) between EN and FR live,
      without reload.
- [x] The Setup and Login screens can be completed entirely in French, with a language toggle
      present before sign-in.
- [x] Catalog names (layouts, fonts, colors, book sizes, masks, frames, papers, roles) show in the
      active language.
- [x] Plurals read correctly in French ("1 photo", "3 photos"; "1 fois", "3 fois").
- [x] Known server/import errors show a French message when the language is French.
- [x] Album content (captions, titles, project name) is never translated.
- [x] The default language on first load follows the browser locale; the choice is remembered.
- [x] `document.documentElement.lang` reflects the active language.
- [x] No layout/engine change: photos are unaffected.

## Edge cases

- Missing `fr` entry: `translate` falls back to `en`, then to the raw key (never blank). A parity
  test prevents missing entries from shipping.
- Unknown browser locale: defaults to English.
- A catalog id with no `fr` override: shows the English lib label (fallback), still readable.
- localStorage unavailable: language still works in memory (like the other view prefs).
- Interpolation with a missing param: leaves the `{name}` token rather than crashing.
- Native `confirm()` OK/Cancel buttons are browser-provided and stay in the browser's language
  (out of scope); the confirm message text itself is translated.

## Architecture (flow + files)

```
navigator.language --detectLang--> viewStore.lang (localStorage pp.lang)
  useT() subscribes to viewStore.lang
    component calls t("key", params)  ->  translate(lang, key, params)  [PURE]
      messages[lang][key] ?? messages.en[key] ?? key, with {param} interpolation
  language effect -> document.documentElement.lang + --caption-placeholder CSS var
```

New files: `src/lib/i18n.ts` (+ `src/lib/i18n.test.ts`), `src/useT.ts`,
`src/components/LanguageMenu.tsx`. Changed: `src/viewStore.ts` (lang pref), `src/index.css`
(caption placeholder var), `src/lib/bundle.ts` (error `code`), and every `src/components/*.tsx`
+ `src/App.tsx` that holds chrome strings. No change under `src/lib/layout*`, no data-model change,
no `ProjectDoc` change (language is a device preference, not album data).

## Invariant

Not applicable to the layout engine. This spec changes displayed text only; no photo is resized,
cropped, or distorted, and `src/lib/layout.ts` is not touched.
