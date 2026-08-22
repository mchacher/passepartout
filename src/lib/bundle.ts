// Project bundle (spec 021): a portable, self-contained file that captures one album -
// its full ProjectDoc plus every image blob - so a project can be backed up and moved to
// another Passepartout instance. Pure and framework/DOM-free (uses fflate for the zip), so
// it is unit-testable; the impure parts (reading blobs from IndexedDB, download, upload)
// live in the store and the ProjectMenu.
//
// A bundle is a standard ZIP:
//   album.json          the BundleManifest (JSON, UTF-8)
//   images/<photoId>    the original image bytes, one file per photo that has a blob

import { zipSync, unzipSync, strToU8, strFromU8, type Zippable } from "fflate";
import type { ProjectDoc } from "./project";

/** The bundle format tag and version. Bump VERSION on any breaking manifest change. */
export const BUNDLE_FORMAT = "passepartout-album";
export const BUNDLE_VERSION = 1;

const MANIFEST_NAME = "album.json";
const IMAGE_DIR = "images/";

/** An image inside a bundle: its raw bytes and the mime to rebuild the Blob on import. */
export interface BundleImage {
  bytes: Uint8Array;
  mime: string;
}

/** The JSON manifest stored at album.json. */
export interface BundleManifest {
  format: typeof BUNDLE_FORMAT;
  version: number;
  exportedAt: number; // ms epoch
  doc: ProjectDoc;
  imageMime: Record<string, string>; // photoId -> blob mime
}

/** Everything a bundle yields when parsed. */
export interface ParsedBundle {
  doc: ProjectDoc;
  images: Map<string, BundleImage>;
  exportedAt: number;
}

/** Stable identifiers for each bundle failure, so the UI can translate the message (spec 032). */
export type BundleErrorCode =
  | "not-zip"
  | "missing-manifest"
  | "corrupt-manifest"
  | "not-bundle"
  | "newer-version"
  | "no-project";

/** A bundle that is not a valid Passepartout album (bad zip, wrong format, etc.). */
export class BundleError extends Error {
  readonly code: BundleErrorCode;
  constructor(code: BundleErrorCode, message: string) {
    super(message);
    this.name = "BundleError";
    this.code = code;
  }
}

/**
 * Build a bundle for one project: the manifest plus every image. Image bytes are stored
 * (not re-deflated) since photos are already compressed; the small manifest is deflated.
 */
export function buildBundle(doc: ProjectDoc, images: Map<string, BundleImage>, now: number): Uint8Array {
  const imageMime: Record<string, string> = {};
  const files: Zippable = {};
  for (const [id, img] of images) {
    imageMime[id] = img.mime;
    files[`${IMAGE_DIR}${id}`] = [img.bytes, { level: 0 }];
  }
  const manifest: BundleManifest = {
    format: BUNDLE_FORMAT,
    version: BUNDLE_VERSION,
    exportedAt: now,
    doc,
    imageMime,
  };
  files[MANIFEST_NAME] = [strToU8(JSON.stringify(manifest)), { level: 9 }];
  return zipSync(files);
}

/**
 * Parse a bundle, validating it is a Passepartout album of a supported version. Throws a
 * BundleError (never a raw zip/JSON error) on anything malformed, so the UI can report a
 * clear message and change nothing.
 */
export function parseBundle(bytes: Uint8Array): ParsedBundle {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new BundleError("not-zip", "This file is not a valid zip archive.");
  }

  const manifestBytes = files[MANIFEST_NAME];
  if (!manifestBytes) {
    throw new BundleError("missing-manifest", "This is not a Passepartout album bundle (missing album.json).");
  }

  let manifest: Partial<BundleManifest>;
  try {
    manifest = JSON.parse(strFromU8(manifestBytes)) as Partial<BundleManifest>;
  } catch {
    throw new BundleError("corrupt-manifest", "The album bundle manifest is corrupt.");
  }

  if (!manifest || manifest.format !== BUNDLE_FORMAT) {
    throw new BundleError("not-bundle", "This is not a Passepartout album bundle.");
  }
  if (typeof manifest.version !== "number") {
    throw new BundleError("corrupt-manifest", "The album bundle manifest is corrupt.");
  }
  if (manifest.version > BUNDLE_VERSION) {
    throw new BundleError("newer-version", "This bundle was created by a newer version of Passepartout.");
  }
  if (!manifest.doc || typeof manifest.doc !== "object") {
    throw new BundleError("no-project", "This album bundle has no project.");
  }

  const images = new Map<string, BundleImage>();
  const mimes = manifest.imageMime ?? {};
  for (const id of Object.keys(mimes)) {
    const b = files[`${IMAGE_DIR}${id}`];
    if (b) images.set(id, { bytes: b, mime: mimes[id] });
  }

  return { doc: manifest.doc as ProjectDoc, images, exportedAt: manifest.exportedAt ?? 0 };
}
