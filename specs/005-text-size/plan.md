# 005 - Album text size - Implementation plan

Order: pure module -> tests -> project helpers -> store -> CSS -> components ->
apply hook + menu.

## Steps

1. **Pure module** - `src/lib/text-sizes.ts` (new): `TextRole`, `TextSizeLevel`,
   `TextSizes`, `TEXT_ROLES`, `TEXT_SIZE_LEVELS`, `SIZE_SCALE`, `DEFAULT_TEXT_SIZES`,
   `textSizesOrDefault`, `textScaleVars`.

2. **Tests** - `src/lib/text-sizes.test.ts` (new): catalogs, scale map, coercion
   (missing + unknown per-role), `textScaleVars` output.

3. **Project helpers** - `src/lib/project.ts`: add `textSizes` to `ProjectDoc` /
   `ProjectState`; `newProjectDoc` defaults; `serializeProject` carries it;
   `duplicateDoc` carries it via `textSizesOrDefault`. Extend `project.test.ts`
   (`state()` gains `textSizes`; assert round-trip + duplicate + newProjectDoc default).

4. **Store** - `src/store.ts`: root `textSizes` (default) + `setTextSize(role, level)`
   (set that role only + `scheduleSave`); `createProject` from `doc.textSizes`;
   `openProject` via `textSizesOrDefault(doc.textSizes)`; `flushSave` slice includes it;
   `deleteProject` empty fallback resets to defaults. Extend `store.test.ts`.

5. **CSS** - `src/index.css`: `--title-scale`, `--subtitle-scale`, `--caption-scale`
   default `1` in `:root`.

6. **Components** - multiply the four sizes by the role scale var:
   - `CoverCard.tsx` title + subtitle.
   - `Paper.tsx` page title + caption (move `text-[10.5px]` to inline `calc`).

7. **Apply hook + menu**:
   - `useApplyTheme`: read `textSizes`, add `textScaleVars` to the vars written on
     `<html>`, add `textSizes` to the effect deps.
   - `ThemeMenu.tsx`: add a **Text size** section (one S/M/L segmented row per role)
     wired to `setTextSize`.

8. **Docs**: fold into `docs/architecture.md` (data-model bullet + extension point),
   `docs/overview.md`, `README.md` if user-facing.

## Test Plan

| Module     | Scenario                                             | Expected                                            |
| ---------- | --------------------------------------------------- | --------------------------------------------------- |
| text-sizes | `TEXT_ROLES` / `TEXT_SIZE_LEVELS` well-formed        | 3 roles, 3 levels, unique                           |
| text-sizes | `SIZE_SCALE` has md === 1                            | md maps to 1 (defaults change nothing)              |
| text-sizes | `textSizesOrDefault` on missing / partial / unknown | every role coerced to a valid level, md fallback    |
| text-sizes | `textScaleVars(defaults)`                           | all three vars === "1"                              |
| text-sizes | `textScaleVars` with sm/lg                          | var === String(SIZE_SCALE[level])                   |
| project    | `newProjectDoc` textSizes                           | all roles md                                        |
| project    | `serializeProject` carries textSizes                | doc has state's textSizes                           |
| project    | `duplicateDoc` carries textSizes                    | copy keeps textSizes                                |
| store      | `setTextSize` changes only its role                 | other roles + theme unchanged                       |
| store      | `createProject` resets textSizes to defaults        | new project all md                                  |
| store      | open a legacy doc missing textSizes                 | state textSizes = defaults, no throw                |
| store      | choosing a size persists (save/load round-trip)     | reloaded doc keeps the level                        |
| layout     | (regression) engine untouched                       | existing ratio + fit tests stay green               |

## Verify in app (Phase 5)

- `npm run build && npm run preview`, Load an example.
- In the Style menu, set Title = Large, Caption = Small: the cover + page titles grow,
  captions shrink, subtitle unchanged, and no photo moves or resizes. Reload: levels
  persist. Confirm a portrait stays portrait and a panorama stays intact.
