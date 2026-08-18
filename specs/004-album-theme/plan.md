# 004 - Album theme - Implementation plan

Order follows the workflow: pure catalog -> tests -> project helpers -> store ->
CSS/Tailwind -> components -> apply effect.

## Steps

1. **Pure catalog** - `src/lib/themes.ts` (new)
   - [x] `FontThemeId` union + `FontTheme` interface + `FONT_THEMES` (5 system-font
         stacks). `serif` stack === today's `font-display` stack.
   - [x] `ColorThemeId` union + `ColorTheme` / `AccentSet` interfaces +
         `COLOR_THEMES` (5). `classic` === today's exact paper/ink/accent values.
   - [x] `DEFAULT_FONT_THEME`, `DEFAULT_COLOR_THEME`.
   - [x] `fontThemeOrDefault(id?)`, `colorThemeOrDefault(id?)`.

2. **Catalog tests** - `src/lib/themes.test.ts` (new) - see Test Plan.

3. **Project helpers** - `src/lib/project.ts`
   - [x] Add `fontTheme: FontThemeId`, `colorTheme: ColorThemeId` to `ProjectDoc`
         and `ProjectState`.
   - [x] `newProjectDoc` sets both to defaults.
   - [x] `serializeProject` carries both from state.
   - [x] `duplicateDoc` carries both (coerced through `*OrDefault` for legacy src).
   - [x] Extend `src/lib/project.test.ts`: `state()` gains the two fields; assert
         they round-trip and duplicate; `newProjectDoc` has defaults.

4. **Store** - `src/store.ts`
   - [x] Root state: `fontTheme`, `colorTheme` (init to defaults) + actions
         `setFontTheme`, `setColorTheme` (set + `scheduleSave`).
   - [x] `createProject`: reset both to `doc.fontTheme` / `doc.colorTheme`.
   - [x] `openProject`: set from `fontThemeOrDefault(doc.fontTheme).id` /
         `colorThemeOrDefault(doc.colorTheme).id` (legacy/unknown -> default).
   - [x] `flushSave` serialize slice: include `fontTheme`, `colorTheme`.
   - [x] `deleteProject` empty fallback: reset both to defaults.
   - [x] Extend `src/store.test.ts` - see Test Plan.

5. **CSS + Tailwind**
   - [x] `src/index.css`: add `--album-ink`, `--album-ink-soft`, `--album-font`
         defaults (classic/serif) in `:root`.
   - [x] `tailwind.config.js`: add `album: ["var(--album-font)"]` to `fontFamily`.

6. **Album components** - swap hardcoded values to vars + album font:
   - [x] `Paper.tsx:76-77` page title: `font-display` -> `font-album`,
         `color:"#1C2226"` -> `color:"var(--album-ink)"`.
   - [x] `Paper.tsx:154-157` caption: add `font-album`,
         `color:"#4A5157"` -> `color:"var(--album-ink-soft)"`.
   - [x] `CoverCard.tsx:134-135` title: `font-display` -> `font-album`,
         `color:"#1C2226"` -> `var(--album-ink)`.
   - [x] `CoverCard.tsx:141-142` subtitle: `font-display` -> `font-album`,
         `color:"#4A5157"` -> `var(--album-ink-soft)`.
   - (Chrome `font-display` usages in TopBar/Library/PageCard/App/CoverCard header
     are left as-is.)

7. **Apply effect + picker**
   - [x] `src/lib/theme-vars.ts` (new, pure): `themeCssVars(color, font, mode)` ->
         a `Record<string,string>` of the custom properties to set. Unit-tested.
   - [x] `useApplyTheme()` hook (in `App.tsx` or `src/components/`): reads
         `colorTheme`/`fontTheme` from the store, resolves via `*OrDefault`, writes
         `themeCssVars` onto `document.documentElement.style`, and re-applies the
         accent on `prefers-color-scheme` change. Called from `App`.
   - [x] `src/components/ThemeMenu.tsx` (new): dropdown with Font list + Palette
         swatches, mirroring `ProjectMenu`. Wire into `TopBar` before the Format
         group.

8. **Docs (Phase 6)**: fold the durable shape into `docs/architecture.md`
   (data-model bullet + extension point), update `docs/overview.md` and
   `README.md`/`CLAUDE.md` roadmap line if user-facing.

## Test Plan

| Module      | Scenario                                                        | Expected                                                             |
| ----------- | -------------------------------------------------------------- | ------------------------------------------------------------------- |
| themes      | `FONT_THEMES` / `COLOR_THEMES` ids unique                       | no duplicate id                                                     |
| themes      | default ids exist in their catalog                             | `DEFAULT_FONT_THEME` / `DEFAULT_COLOR_THEME` resolve                |
| themes      | every color theme has non-empty paper/ink/inkSoft + accent set  | all fields present, `{light,dark}` on accents                       |
| themes      | every font theme has a non-empty stack                         | truthy string                                                       |
| themes      | `fontThemeOrDefault` / `colorThemeOrDefault` on a valid id      | returns that theme                                                  |
| themes      | `*OrDefault` on unknown / undefined                            | returns the default theme                                          |
| theme-vars  | `themeCssVars(classic, serif, "light")`                        | `--paper` white, `--album-ink` `#1C2226`, `--accent` light value    |
| theme-vars  | same theme, `"dark"` mode                                      | `--accent` = the dark accent variant; `--paper`/`--album-ink` fixed |
| theme-vars  | a font theme                                                   | `--album-font` === that stack                                       |
| project     | `newProjectDoc` defaults                                       | `fontTheme`=default, `colorTheme`=default                          |
| project     | `serializeProject` carries both                               | doc has the state's font/color theme                               |
| project     | `duplicateDoc` carries both                                   | copy keeps font/color theme                                        |
| store       | `setFontTheme` / `setColorTheme` update only that field        | other theme + format unchanged                                     |
| store       | `createProject` resets theme to defaults                      | new active project has default font/color                          |
| store       | open a legacy doc missing the fields                          | state font/color = defaults, no throw                              |
| store       | choosing a theme persists (round-trip through save/load)      | reloaded doc keeps the choice                                      |
| layout      | (regression) engine untouched                                 | existing ratio + fit tests stay green (no new engine code)          |

## Verify in app (Phase 5)

- `npm run build && npm run preview`, Load an example.
- Open the theme picker, switch fonts: cover/page titles + captions change font;
  photos do not move or resize. Switch palettes: paper + text + chrome accent
  change together. Confirm a portrait stays portrait and a panorama stays intact.
- Reload: the chosen theme persists. Toggle OS dark mode: chrome accent stays
  legible, album paper stays a print color.
