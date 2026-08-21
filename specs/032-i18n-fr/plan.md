# Plan 032: i18n with a French translation

## Implementation steps (in order)

1. **i18n core** `src/lib/i18n.ts` (pure): `Lang`, `LANGS`, `DEFAULT_LANG`, `detectLang`,
   `translate(lang, key, params?)` (interpolation + `fr->en->key` fallback), `plural(lang, count,
   {one, other})`. Define the `en` + `fr` message maps for all inline keys (namespaced:
   `app.*`, `topbar.*`, `project.*`, `page.*`, `cover.*`, `library.*`, `export.*`, `theme.*`,
   `size.*`, `spine.*`, `rail.*`, `preview.*`, `crop.*`, `zoom.*`, `auth.*`, `users.*`, `admin.*`,
   `update.*`, `err.*`). Derive catalog-name `en` values from the pure lib catalogs; add `fr`
   overrides keyed by catalog id (`layout.<id>`, `font.<id>`, `color.<id>`, `size.<id>`,
   `mask.<id>`, `frame.<id>`, `frameColor.<id>`, `borderWidth.<id>`, `paper.<id>`, `role.<id>`).
2. **i18n tests** `src/lib/i18n.test.ts`: parity, interpolation, plural (EN + FR), detectLang,
   fallback, every catalog id has an `fr` entry (see Test Plan).
3. **bundle error codes** `src/lib/bundle.ts`: add a stable `code` to `BundleError`; map codes to
   `err.bundle.*` keys in the catalog.
4. **view pref** `src/viewStore.ts`: `lang` state + `setLang`, localStorage `pp.lang`, default
   `detectLang(navigator.language)`.
5. **hook** `src/useT.ts`: `useT()` reads `viewStore.lang`, returns `t(key, params?)`; also export
   a `usePlural()` (or fold plural into the same hook) and a small effect helper for
   `document.documentElement.lang` + `--caption-placeholder`.
6. **language selector** `src/components/LanguageMenu.tsx`: globe + EN/FR; a compact variant for the
   auth screens.
7. **CSS** `src/index.css`: replace the hardcoded caption placeholder `content` with
   `var(--caption-placeholder)`.
8. **Wire the app**: `App.tsx` mounts the language effect (html lang + caption var). Replace every
   chrome string with `t()` across: TopBar, ProjectMenu, ThemeMenu, SizeMenu, PageCard, CoverCard,
   Library, ExportPanel, BookPreview, PreviewPaper(if any), CropEditor, ZoomControl, SpineCard,
   PageRail, Setup, Login, UsersPanel, AdminMenu, UpdatesSheet, UpdatingOverlay, Paper(remove title),
   App empty state. Server/import errors use `err.*` keys with a translated generic fallback.

## Test Plan

| Module | Scenario | Expected |
| ------ | -------- | -------- |
| i18n   | `translate("fr", key)` for a known key | French string |
| i18n   | `translate("fr", missingKey)` | falls back to `en` value |
| i18n   | `translate("en", unknownKey)` | returns the key itself (never blank) |
| i18n   | `translate(lang, "x {n} y", {n: 3})` | `"x 3 y"` |
| i18n   | interpolation with a missing param | leaves `{n}` literal, no throw |
| i18n   | `plural("en", 1, {one,other})` / `("en", 3, ...)` | one / other |
| i18n   | `plural("fr", 0, ...)` and `("fr", 1, ...)` | both singular (one) |
| i18n   | `plural("fr", 2, ...)` | other |
| i18n   | `detectLang("fr-FR")` / `("fr")` / `("en-US")` / `(undefined)` | fr / fr / en / en |
| i18n   | **parity**: `Object.keys(fr)` set === `Object.keys(en)` set | equal (no missing/extra) |
| i18n   | **catalog coverage**: every id in each lib catalog has an `fr` entry | present for all |
| i18n   | bundle error `code` maps to an existing `err.bundle.*` key | key exists in both langs |
| viewStore | default `lang` from a `fr*` navigator locale | `fr` |
| viewStore | `setLang("fr")` persists `pp.lang` and updates state | persisted + state = fr |
| viewStore | localStorage throwing does not break `setLang` | state still updates |

UI coverage (switch flips every surface, auth-in-French, no album-content translation, html lang)
is verified in-app in Phase 5 (this project has no React component tests), light + dark.

## Notes

- No engine/ratio test needed: `src/lib/layout.ts` is untouched (text-only feature). The Gate 4
  ratio assertions still run (existing layout tests), proving no regression.
- Keep English as the authored source; `fr` is the overlay. A changed English string must get its
  `fr` updated (the parity test catches an orphaned/missing key).
