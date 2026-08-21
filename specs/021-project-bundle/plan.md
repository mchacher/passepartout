# 021 - Project bundle - Implementation plan

## Steps (in order)

1. **Dependency**: add `fflate` (tiny, zero-dep, MIT) to `package.json`.
2. **lib/bundle.ts** (pure): `BUNDLE_VERSION`, `BundleManifest`, `BundleError`,
   `buildBundle(doc, images, now): Uint8Array`, `parseBundle(bytes): { doc, images, exportedAt }`.
   - `images` is `Map<string, { bytes: Uint8Array; mime: string }>`.
   - Zip: `album.json` (manifest JSON) + `images/<id>` per image.
   - Validate on parse: valid zip, `album.json` present and JSON, `format` tag matches,
     `version` supported, `doc` present. Throw `BundleError` otherwise.
3. **lib/bundle.test.ts**: the Test Plan below.
4. **store.ts**:
   - `exportBundle(id?): Promise<{ bytes: Uint8Array; name: string } | null>` - flush,
     load doc, read each image blob (`getImage`), `buildBundle`, return bytes + a safe
     filename (`<name>.passepartout.zip`).
   - `importBundle(file: File): Promise<{ ok: true } | { ok: false; error: string }>` -
     read file bytes, `parseBundle`, remap photo ids (`duplicateDoc`), `putImage` each new
     id from the bundle bytes (as a `Blob` with its mime), `saveProjectDoc`, upsert meta,
     `openProject`. Gate on `persistent`.
5. **components/ProjectMenu.tsx**: an **Export** action (active project) that downloads the
   returned bytes; an **Import** action (hidden `<input type="file">`) next to **New**;
   surface import errors with an inline message / `alert`.
6. **Docs**: README feature list + roadmap (mark backup/transfer done); a line in
   `docs/architecture.md` about the bundle if persistence is documented there.

## Test Plan

| Module | Scenario | Expected |
| ------ | -------- | -------- |
| bundle | build then parse a doc with 2 images | same doc; same image bytes + mime for each id |
| bundle | manifest content | `format: "passepartout-album"`, `version: BUNDLE_VERSION`, `exportedAt` set |
| bundle | doc with a photo that has no image entry | parses; that id simply absent from `images` |
| bundle | parse random non-zip bytes | throws `BundleError` (not a raw fflate error) |
| bundle | parse a zip with no `album.json` | throws `BundleError` |
| bundle | parse a zip whose manifest `format` is wrong | throws `BundleError` |
| bundle | parse a manifest `version` greater than `BUNDLE_VERSION` | throws `BundleError` (newer version) |
| bundle | image bytes round-trip exactly (byte-for-byte) | `parse(build(x)) === x` for the image bytes |

Engine invariant: this feature does not call `computeLayout` and adds no ratio/size logic,
so there is no ratio/fit assertion to add - noted explicitly per the workflow.

## Verification (Phase 5, in-app)

- Load the example, **Export** -> a `.passepartout.zip` downloads.
- Simulate a fresh instance (clear IndexedDB) and **Import** the file -> the album reopens
  with all pages and full-resolution photos; covers/spine/theme/book size intact.
- Import the same bundle again -> a second independent project appears (no overwrite).
- Import a non-bundle file -> a clear error, nothing changes.
