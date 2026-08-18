# 002 - Projects (local persistence + project management)

## Context

Everything today lives in Zustand memory, and each photo's `url` is an ephemeral
`URL.createObjectURL` handle. A page refresh wipes the whole album: photos, pages,
layouts, whitespace, captions. There is no way to keep more than one album either.

We want **named projects that persist locally** so a refresh restores exactly where
you were, and you can manage several albums.

## Goals

- **Survive refresh**: the active project is auto-saved locally and restored on load.
- **Multiple projects**: create, open (switch), rename, duplicate, delete. A project
  switcher lives in the top bar; the active project name is shown and editable.
- **Local-first, no network**: images are stored as blobs in **IndexedDB**; project
  metadata (pages, photo records, format, layout, whitespace, captions) is a small
  JSON document in IndexedDB too. Nothing leaves the machine.
- Keep the one rule intact: persistence stores the **original image bytes**, so every
  photo keeps its native ratio on reload. The engine is not touched.

## Non-goals

- No export/import of a project file (backup, move machine, share). Roadmap, later.
- No cloud, no accounts, no sync between tabs or devices (last write wins per tab).
- No undo/history, no project cover thumbnails in this version.
- No change to the layout engine or the no-crop invariant.

## Requirements

1. **Persistence layer** (`src/persistence.ts`, browser IndexedDB adapter):
   - Object stores: `projects` (keyPath `id`, holds a `ProjectDoc`) and `images`
     (key = photo id, holds a `Blob`).
   - `listProjects()`, `loadProjectDoc(id)`, `saveProjectDoc(doc)`,
     `deleteProject(id)` (doc + its images), `putImage(id, blob)`, `getImage(id)`.
   - The last-active project id is remembered (localStorage pointer, a tiny string).
   - Every call is wrapped so a missing/blocked IndexedDB (private mode, quota) never
     crashes the app: it degrades to in-memory and surfaces a non-blocking warning.
2. **Pure project helpers** (`src/lib/project.ts`, no browser API, unit-tested):
   - `ProjectDoc`, `ProjectMeta`, `StoredPhoto = Omit<Photo, "url">`.
   - `newProjectDoc(name)`, `serializeProject(state) -> ProjectDoc` (strips `url`),
     `hydratePhotos(doc, urlFor) -> Photo[]` (re-attaches a runtime `url` per photo),
     `duplicateDoc(doc, newId, newName)`.
3. **Store** (`src/store.ts`): holds `projects: ProjectMeta[]`, `activeId`, plus the
   existing `photos/pages/format`. New actions: `initProjects()` (load list + last
   active), `createProject(name?)`, `openProject(id)`, `renameProject(id, name)`,
   `duplicateProject(id)`, `deleteProject(id)`. Every mutation of the active album
   (`importFiles`, `loadDemo`, placement, counts, titles, whitespace, layout, page
   add/delete, captions, format) **auto-saves** the active `ProjectDoc` (debounced).
   Image blobs are written once, at import/demo time.
4. **Image lifecycle**: on import/demo, store the blob and create an object URL for
   runtime. On `openProject`, revoke the previous project's object URLs, load the doc,
   read each blob, and create fresh object URLs. A photo whose blob is missing is
   skipped (never a crash).
5. **First run / empty**: with no projects, the empty state still shows; the first
   import or "Load an example" creates a default project ("Untitled") and persists it.
   Renaming is inline in the switcher.
6. **UI** (`src/components/ProjectMenu.tsx` in the top bar): the active project name as
   a button opening a dropdown with the project list (click to switch, newest first),
   plus New / Rename / Duplicate / Delete. Deleting the active project switches to the
   most recent remaining one, or back to the empty state if none.

## Architecture

New / changed files:

- `src/lib/project.ts` (new, pure) - doc types + serialize/hydrate/duplicate helpers.
- `src/lib/project.test.ts` (new) - round-trip + strip-url + duplicate tests.
- `src/persistence.ts` (new, browser adapter) - IndexedDB open + CRUD + blob store.
- `src/persistence.test.ts` (new, `fake-indexeddb`) - save/load/delete/list + blobs.
- `src/types.ts` (changed) - `Photo` gains nothing persisted; add project constants.
- `src/store.ts` (changed) - projects state + actions + debounced auto-save + blob IO.
- `src/store.test.ts` (changed) - project CRUD state transitions (with fake-indexeddb).
- `src/components/ProjectMenu.tsx` (new) - the switcher dropdown.
- `src/components/TopBar.tsx` (changed) - mount `ProjectMenu`.
- `src/App.tsx` (changed) - call `initProjects()` on mount; loading gate.
- `package.json` - add `fake-indexeddb` (devDependency, tests only).

Persistence is deliberately split: `src/lib/project.ts` is **pure** (serialization,
unit-tested), and `src/persistence.ts` is the **impure IndexedDB adapter** (verified
by `fake-indexeddb` tests and by driving the app). This keeps `src/lib/` pure.

Flow (persistence wraps the existing reactive pipeline, engine unchanged):

```
App mount -> store.initProjects() -> load last-active ProjectDoc + blobs
  -> hydrate photos (object URLs) -> photos/pages/format in the store
    -> (unchanged) PageCard controls -> Paper -> computeLayout [pure]
  any album mutation -> debounced saveProjectDoc(serializeProject(state))
  import/demo -> putImage(blob) once + object URL
```

## Acceptance criteria

- [x] After importing photos and editing pages, a **refresh restores everything**
      (photos, placements, titles, layouts, whitespace levels, captions, format).
      Verified in-app: title, layout, whitespace, project name and all 12 photos
      restored after a hard reload.
- [x] The top bar shows a project switcher; New / Open / Rename / Duplicate / Delete
      all work and persist.
- [x] Switching projects swaps the whole album and revokes stale object URLs.
- [x] Deleting a project removes its doc and its image blobs from IndexedDB.
- [x] Every photo keeps its exact ratio after a reload (no crop, unchanged framing).
      Verified: ratios [0.666, 1.501, 1] intact after reload.
- [x] IndexedDB unavailable (private mode/quota) degrades gracefully with a warning,
      app still usable in-memory.
- [x] `npm run validate` is green (pure helpers + persistence adapter tested).

## Edge cases

| Case                              | Expected                                                       |
| --------------------------------- | -------------------------------------------------------------- |
| Refresh mid-edit                  | Active project restored exactly.                               |
| No projects yet                   | Empty state; first import/demo creates "Untitled".             |
| Delete the active project         | Switch to most recent remaining, else empty state.            |
| Duplicate a project               | New id + name, same pages/photos, independent image blobs.     |
| Photo blob missing on load        | That photo is skipped; the rest of the project loads.          |
| IndexedDB blocked (private mode)  | A persistent banner explains persistence is off; app runs in-memory. |
| Large import                      | Blobs streamed to IndexedDB; a write error warns, no crash.    |
| Two tabs, same project            | Out of scope: last write wins (documented, not handled).       |
| Rapid edits                       | Auto-save is debounced; only the latest doc is written.        |
| Switch/delete within the debounce | The outgoing project's pending save is flushed before a switch, and cancelled before deleting the active project, so no edit is lost and a deleted project cannot resurrect. |
| Refresh within the debounce       | A `visibilitychange` (hidden) flush shrinks the window; an edit in the last instant before an instant reload may still miss (async IndexedDB cannot block unload). |
