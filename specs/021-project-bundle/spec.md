# 021 - Project bundle (backup & transfer)

## Context

Passepartout is local-first: a project lives only in the current browser's IndexedDB
(`projects` doc + `images` blobs, see `src/persistence.ts`). There is no way to back an
album up or to move it to another instance (another browser, machine, or a colleague's
Passepartout). The only export is the print PDF, which is output-only and not re-importable.

## Goal

A single **project bundle** file that fully captures one album (its document plus every
image blob), so a user can:

- **back up** an album to a file and restore it later, and
- **transfer** an album to another Passepartout instance.

## Non-goals

- No cloud sync, no server, no accounts (the local-first design is unchanged).
- No merge/diff of projects: import always creates an independent **new** project.
- No partial export (single page, single photo): the unit is a whole project.
- No change to the print PDF export.

## Requirements

1. **Export**: from the project menu, download the active project as a single `.zip`
   bundle containing a JSON manifest (the full `ProjectDoc`) and every image blob.
2. **Import**: from the project menu, pick a bundle file; it is imported as a **new**
   project (fresh project id, remapped photo ids so it owns independent image blobs) and
   opened. The source instance and any existing projects are untouched.
3. The bundle is **self-contained and portable**: importing it on a fresh instance
   reproduces the album exactly (pages, photos at full resolution, covers, spine, themes,
   text sizes, book size), with no external dependency.
4. Round-trip is **lossless**: export then import yields the same document and the same
   image bytes (only ids and timestamps differ, by design).
5. Invalid input is handled gracefully: a non-zip, a zip that is not a Passepartout
   bundle, or a bundle from an unsupported version fails with a clear message and changes
   nothing.
6. The layout engine is **not touched**: no photo is cropped, clipped, or resized. (This
   feature only moves data.)

## Architecture

```
Export:  store.exportBundle(id)
  flushPending -> load ProjectDoc from db -> read each image Blob (db.getImage)
  -> lib/bundle.buildBundle(doc, images, now) -> zip bytes -> component downloads a .zip

Import:  store.importBundle(file)
  file -> bytes -> lib/bundle.parseBundle(bytes) -> { doc, images }
  -> remap photo ids (duplicateDoc) -> db.putImage(newId, blob) + db.saveProjectDoc
  -> upsert meta -> openProject
```

- **`src/lib/bundle.ts`** (new, pure, framework/DOM-free; uses `fflate` for zip): builds
  and parses the bundle. `buildBundle(doc, images, now): Uint8Array`;
  `parseBundle(bytes): { doc, images }`. Validates the manifest and throws a typed
  `BundleError` on anything malformed. Unit-tested with `fflate` in Node.
- **`src/store.ts`**: `exportBundle(id): Promise<{ bytes; name } | null>` and
  `importBundle(file): Promise<ImportResult>`. Import mirrors `duplicateProject`
  (id remap + `copyImage`/`putImage`), but sources bytes from the file instead of the db.
- **`src/components/ProjectMenu.tsx`**: an **Export** action on the active project and an
  **Import** action (hidden file input) next to **New**.
- **Dependency**: `fflate` (tiny, zero-dependency, MIT), synchronous `zipSync`/`unzipSync`.

### Bundle format (v1)

A standard ZIP containing:

```
album.json            # BundleManifest (JSON, UTF-8)
images/<photoId>      # the original image bytes, one file per photo that has a blob
```

```ts
interface BundleManifest {
  format: "passepartout-album"; // fixed tag, identifies our bundles
  version: 1;                   // BUNDLE_VERSION
  exportedAt: number;           // ms epoch
  doc: ProjectDoc;              // the full persisted project document
  imageMime: Record<string, string>; // photoId -> blob mime, to rebuild the Blob on import
}
```

## Acceptance criteria

- [x] The project menu offers **Export** (downloads `<name>.passepartout.zip`) and
      **Import** (file picker) for the active project.
- [x] Exporting then importing a project reproduces every page, photo (full resolution),
      cover, spine, theme, text size and book size.
- [x] Import creates a **new** project (new ids), opens it, and leaves existing projects
      and their blobs untouched (re-importing into the same instance yields an independent
      copy, not an overwrite).
- [x] A bundle exported on one instance imports correctly on a different, empty instance.
- [x] A non-zip file, a zip missing `album.json`, a wrong `format` tag, or an unsupported
      `version` fails with a clear message and changes nothing.
- [x] `bundle.ts` is pure and unit-tested (round-trip + each invalid case). No photo is
      cropped or resized (the engine is untouched).

## Edge cases

- **Missing image blob** at export (a photo record with no stored blob): skip that image;
  on import the photo is dropped by the existing `hydratePhotos` (a broken image never
  crashes the load).
- **Non-persistent browser** (IndexedDB unavailable): import is disabled with the same
  note the menu already shows for saving; export still works (it reads the active state).
- **Large albums** (many full-resolution photos): the zip is built in memory; blobs are
  stored (not re-compressed hard) so export stays fast and images stay lossless.
- **Corrupt or truncated zip**: `parseBundle` throws `BundleError`; the UI reports it and
  nothing is written.
- **Bundle from a newer app version** (`version` > 1): rejected with a clear message
  ("created by a newer version of Passepartout").
- **Filename collisions on import**: never an issue - all ids are regenerated.
