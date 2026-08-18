# 003 - Covers - Implementation plan

Order: types -> pure lib -> lib tests -> store -> store tests -> components -> App.
The layout engine is untouched (covers reuse `computeLayout` with a single slot).

## Steps

1. **Types** (`src/types.ts`)
   - `interface Cover { title: string; subtitle: string; photoId: string | null; whitespace: number }`.

2. **Pure project helpers** (`src/lib/project.ts`)
   - `newCover(): Cover` = `{ title: "", subtitle: "", photoId: null, whitespace: DEFAULT_WHITESPACE }`.
   - `coverOrDefault(c: Cover | undefined | null): Cover` - backward compat for old docs.
   - `ProjectDoc` + `ProjectState` gain `frontCover: Cover`, `backCover: Cover`.
   - `newProjectDoc` sets both to `newCover()`.
   - `serializeProject` copies both covers (shallow clone).
   - `duplicateDoc` remaps `frontCover.photoId` and `backCover.photoId` via `photoIdMap`.
   - Add `cleanCover(cover, existingPhotoIds): Cover` -> null the `photoId` if absent.

3. **Pure lib tests** (`src/lib/project.test.ts`) - see Test Plan.

4. **Store** (`src/store.ts`)
   - State: `frontCover: Cover`, `backCover: Cover` (init `newCover()`).
   - `updateCover(which: "front" | "back", patch: Partial<Cover>)` -> set + `scheduleSave`.
   - `serializeProject` call includes `frontCover`/`backCover`.
   - `createProject`: set covers from the new doc (`newCover`).
   - `openProject`: `coverOrDefault` each, then `cleanCover` against hydrated photo ids.

5. **Store tests** (`src/store.test.ts`) - `updateCover`, persistence round-trip, and
   opening a doc saved without cover fields defaults them.

6. **CoverCard** (`src/components/CoverCard.tsx`)
   - Props `{ which: "front" | "back" }`. Reads `frontCover`/`backCover`, `format`, `photos`.
   - Header: label ("Cover" / "Back cover"), whitespace slider (1..8, reuse the pattern).
   - Cover page (page aspect): title + subtitle inputs shown on the page; the cover photo
     measured + laid out via `computeLayout([{ratio}], w, h, autoTemplate(1), { density })`,
     rendered contained and centered; drop target for `PHOTO_DND_TYPE` -> `updateCover`;
     remove control clears the photo. Semantic tokens only.

7. **App** (`src/App.tsx`)
   - Render `<CoverCard which="front" />` before `pages.map(...)` and
     `<CoverCard which="back" />` after the Add page button.

## Test Plan

| Module  | Scenario                                             | Expected                                             |
| ------- | ---------------------------------------------------- | ---------------------------------------------------- |
| project | newProjectDoc                                        | frontCover and backCover are empty `newCover()`      |
| project | serialize -> hydrate/read round-trip                 | both covers (title, subtitle, photoId) preserved     |
| project | duplicateDoc with cover photos                       | cover photoIds remapped through photoIdMap           |
| project | coverOrDefault(undefined)                            | returns a default empty cover (backward compat)      |
| project | cleanCover with a missing photo id                   | photoId -> null, text kept                           |
| store   | updateCover("front", {title})                        | only front cover changes                             |
| store   | createProject then set covers then loadProjectDoc    | covers persisted in the doc                          |
| store   | openProject on a doc saved without cover fields      | covers default, no throw                             |
| layout  | (existing) single slot contain                       | cover photo w/h === ratio, contained (already tested)|

Ratio note: no engine change. The cover photo goes through the same single-slot
`computeLayout` path already guarded by `layout.test.ts` (ratio preserved, contained).

## Tasks

- [x] 1 types (Cover)
- [x] 2 project helpers (covers)
- [x] 3 project tests
- [x] 4 store (covers + updateCover)
- [x] 5 store tests
- [x] 6 CoverCard
- [x] 7 App wiring
- [x] validate green
- [x] verified in-app: front + back covers, text + photo, refresh persists, no crop (Phase 5)
