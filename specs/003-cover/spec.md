# 003 - Covers (front and back, for a complete booklet)

## Context

A project is currently only inner pages. A real photo booklet needs a **cover**: a
front cover (title + optional photo) and a back cover. Without them the export is not
a finished book. This adds both, as part of the project.

## Goals

- The **four faces of a booklet cover** per project, always present (a cover is a
  folded sheet with an outside and an inside, front and back): `front`, `insideFront`
  (the inside of the front cover), `insideBack` (the inside of the back cover), `back`.
- Each face has **text** (a title and a subtitle line) and an **optional photo chosen
  from the library** (drag a library photo onto it; it stays available for pages too).
  The photo is optional: a text-only face is valid.
- They render in booklet order: front, inside front, pages, inside back, back, so the
  project reads as a complete book.
- Keep the one rule: a cover photo is **contained** (fit + centered, ratio exact,
  whitespace around), never cropped or full-bleed. It reuses the same layout engine
  with a single slot, so no engine change and the invariant already holds.

## Non-goals

- No spine, no print bleed/margins on the cover (print detail, roadmap).
- No dedicated cover-only image import (covers reuse library photos, as chosen).
- No layout picker on covers (a single contained photo has no arrangement choice).
- No change to `computeLayout` or the no-crop invariant.

## Requirements

1. **Data model**: a `Cover = { title; subtitle; photoId: string | null; whitespace }`
   and a `CoverFace = "front" | "insideFront" | "insideBack" | "back"`. `ProjectDoc`
   gains `frontCover`, `insideFrontCover`, `insideBackCover`, `backCover`. `photoId`
   references a photo in the project's library (or null). `whitespace` is a level 1..8.
2. **Persistence**: covers are serialized in the `ProjectDoc` and restored on load.
   Loading a project made before this feature (no cover fields) must default both
   covers gracefully (backward compatible). A cover `photoId` whose photo is missing
   on load is cleared to null (never a dangling reference).
3. **Duplicate**: duplicating a project remaps each cover `photoId` through the same
   `photoIdMap` as pages, so the copy owns independent image blobs.
4. **Store**: state holds `frontCover` and `backCover`; a single `updateCover(which,
   patch)` action edits either. Every edit auto-saves (debounced) like page edits.
   `openProject` / `createProject` set the covers (normalized + cleaned).
5. **UI**: one `CoverCard` per face renders a cover page at the project's page format:
   the title and subtitle (editable, face-specific placeholders), and the contained
   cover photo (a drop target for a library photo, with a remove control), plus a
   whitespace control. `App` renders front, inside front, the pages, inside back, back.
6. **Engine**: unchanged. The cover photo is sized by `computeLayout` with a single
   slot (contain-fit), so `w/h === ratio` exactly, no crop.

## Architecture

New / changed files:

- `src/types.ts` - add the `Cover` interface.
- `src/lib/project.ts` - `newCover`, `coverOrDefault`; `ProjectDoc`/`ProjectState`
  gain `frontCover`/`backCover`; `newProjectDoc`, `serializeProject`, `duplicateDoc`
  carry them.
- `src/lib/project.test.ts` - cover round-trip, duplicate remap, defaults, backward
  compat.
- `src/store.ts` - `frontCover`/`backCover` state + `updateCover` + normalize/clean in
  `openProject`/`createProject` + include covers in the serialized doc.
- `src/store.test.ts` - `updateCover`, cover persistence, backward-compat on open.
- `src/components/CoverCard.tsx` - the cover editor + rendered cover page (measures its
  box, lays the single photo out with the engine, DnD photo target, text fields).
- `src/App.tsx` - mount front cover before pages, back cover after.

Flow (reuses the existing pipeline; the cover is a single-slot layout):

```
CoverCard (front/back) -> store.frontCover/backCover (+ updateCover)
  -> measures its photo box -> computeLayout([coverPhoto], w, h, slot, { density })  [pure]
    -> one contained cell, ratio exact, no crop; title/subtitle rendered around it
project doc <-> covers serialized/hydrated alongside pages
```

## Acceptance criteria

- [x] Every project shows the four cover faces in booklet order: front, inside front,
      pages, inside back, back.
- [x] A cover title and subtitle can be typed and persist across a refresh.
      Verified: "Summer 2026" / "A holiday album" restored after a hard reload.
- [x] Dragging a library photo onto a cover sets its cover photo; it renders contained
      (ratio exact, no crop) and can be removed. Verified: ratio dev 0, within box.
- [x] Covers survive a refresh and a project switch; duplicating a project copies them
      with independent blobs.
- [x] Opening a project created before this feature does not crash and shows empty
      covers (backward compatible). Verified in-app on the pre-cover DEMO project.
- [x] A cover photo whose blob is missing loads as a text-only cover (no dangle).
- [x] `npm run validate` is green; engine + invariant untouched.

## Edge cases

| Case                                   | Expected                                                     |
| -------------------------------------- | ------------------------------------------------------------ |
| Text-only cover (no photo)             | Title + subtitle centered, no photo, valid.                  |
| Portrait / panorama cover photo        | Contained, ratio intact, whitespace around, never cropped.   |
| Old project without cover fields       | Both covers default to empty; no crash.                      |
| Cover photo also placed on a page      | Allowed; the same library photo is reused.                   |
| Cover photo's blob missing on load     | `photoId` cleared to null; cover becomes text-only.          |
| Duplicate a project with cover photos  | Copies remap cover `photoId`; blobs copied under new ids.    |
| No photos in the project yet           | Covers appear once the album has content (with the pages).   |
