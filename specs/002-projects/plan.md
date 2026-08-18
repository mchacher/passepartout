# 002 - Projects - Implementation plan

Implement in order (types -> pure lib -> lib tests -> persistence adapter -> store ->
components). The layout engine is untouched.

## Steps

1. **Types** (`src/types.ts`)
   - Add `DEFAULT_PROJECT_NAME = "Untitled"`.
   - (Photo/AlbumPage unchanged; the persisted photo shape is derived in project.ts.)

2. **Pure project helpers** (`src/lib/project.ts`, no browser API)
   - `interface ProjectMeta { id; name; createdAt; updatedAt }`.
   - `type StoredPhoto = Omit<Photo, "url">`.
   - `interface ProjectDoc extends ProjectMeta { format: PageFormat; photos: StoredPhoto[]; pages: AlbumPage[] }`.
   - `newProjectDoc(name, now): ProjectDoc` (empty photos, no pages yet, uuid id; the
     empty state shows until the first import distributes photos into pages).
   - `serializeProject({ id, name, createdAt, format, photos, pages }, now): ProjectDoc`
     - strips `url` from each photo, stamps `updatedAt = now`.
   - `hydratePhotos(doc, urlFor: (id) => string | undefined): Photo[]`
     - re-attaches `url`; drops photos with no url (missing blob).
   - `duplicateDoc(doc, { id, name, now, photoIdMap }): ProjectDoc` remaps every photo
     id (and page `photoIds`) through `photoIdMap`, so the copy owns independent image
     blobs. The store builds the map (new UUIDs) and copies each blob old id -> new id,
     so deleting one project can never touch another's blobs.
   - `metaOf(doc): ProjectMeta`.

3. **Pure lib tests** (`src/lib/project.test.ts`) - see Test Plan.

4. **Persistence adapter** (`src/persistence.ts`, IndexedDB, hand-rolled, no dep)
   - `openDB()` promise (stores `projects` keyPath `id`, `images` out-of-line key).
   - `listProjects(): Promise<ProjectMeta[]>` (read docs, map to meta, sort updatedAt desc).
   - `loadProjectDoc(id)`, `saveProjectDoc(doc)`, `deleteProject(id)` (doc + its images).
   - `putImage(id, blob)`, `getImage(id): Promise<Blob | undefined>`.
   - `getLastActiveId()/setLastActiveId(id)` via localStorage.
   - `isAvailable()` guard; every export try/catches and reports unavailability so the
     store can degrade. Never throws to the caller for a normal read miss.

5. **Persistence tests** (`src/persistence.test.ts`, `fake-indexeddb/auto`) - see plan.

6. **Store** (`src/store.ts`)
   - State: `projects: ProjectMeta[]`, `activeId: string | null`, `ready: boolean`,
     `persistent: boolean` (false when IndexedDB is unavailable). Keep photos/pages/format.
   - `initProjects()`: list projects; load last-active (or newest); hydrate; set ready.
   - `createProject(name?)`, `openProject(id)` (revoke old object URLs, load doc+blobs,
     hydrate), `renameProject`, `duplicateProject` (copy doc + copy each image blob under
     the new project), `deleteProject`.
   - `ensureActiveProject()`: used by importFiles/loadDemo to create "Untitled" if none.
   - `importFiles`/`loadDemo`: `putImage(photo.id, blob)` + `url = createObjectURL(blob)`;
     demo uses `canvas.toBlob`.
   - `scheduleSave()`: debounced (~400ms) `saveProjectDoc(serializeProject(state))`, and
     refresh the active project's meta in `projects`. Called at the end of every album
     mutation. No-op when not `persistent`.

7. **Store tests** (`src/store.test.ts`, extend) - project CRUD state transitions.

8. **ProjectMenu** (`src/components/ProjectMenu.tsx`)
   - Button with the active name; dropdown: list (switch), New, Rename (inline),
     Duplicate, Delete. Semantic tokens only.

9. **TopBar + App**
   - Mount `ProjectMenu` in `TopBar`. `App` calls `initProjects()` on mount and shows a
     minimal loading state until `ready`; if not `persistent`, show a one-time warning.

## Test Plan

| Module      | Scenario                                              | Expected                                             |
| ----------- | ----------------------------------------------------- | ---------------------------------------------------- |
| project     | serializeProject strips every photo `url`             | no `url` key on any StoredPhoto                       |
| project     | serialize -> hydrate round-trip                       | pages, photo ids, ratios, captions all preserved     |
| project     | hydratePhotos with a missing url (no blob)            | that photo dropped, others intact                    |
| project     | newProjectDoc                                         | uuid id, given name, no pages yet, empty photos      |
| project     | duplicateDoc                                          | new id + name, same pages/photos, timestamps stamped |
| persistence | saveProjectDoc then loadProjectDoc                    | deep-equal doc round-trip                            |
| persistence | putImage then getImage                                | same bytes (Blob size/type) back                     |
| persistence | deleteProject                                         | doc gone AND its images gone                          |
| persistence | listProjects                                          | metas only, sorted by updatedAt desc                 |
| store       | createProject then state                              | activeId set, empty album, meta in `projects`        |
| store       | duplicateProject                                      | new active project, pages copied, independent id     |
| store       | deleteProject (active)                                | switches to newest remaining or empty                |
| store       | renameProject                                         | meta + active name updated                           |

Ratio note: no engine change, so the ratio-preservation guard already in
`layout.test.ts` still stands; project reload preserves ratios because `StoredPhoto`
keeps `w/h/ratio` and the same blob reloads at the same natural size (asserted by the
round-trip test).

## Tasks

- [x] 1 types
- [x] 2 project helpers
- [x] 3 project tests
- [x] 4 persistence adapter
- [x] 5 persistence tests
- [x] 6 store
- [x] 7 store tests
- [x] 8 ProjectMenu
- [x] 9 TopBar + App wiring
- [x] validate green
- [x] verified in the real app: import, edit, REFRESH, everything restored (Phase 5)
