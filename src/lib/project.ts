// Pure project helpers.
//
// A project is one album: its pages, photos, and page format. This module only
// shapes data (no DOM, no React, no IndexedDB), so it is unit-testable; the impure
// IndexedDB read/write lives in src/persistence.ts. The only global it touches is
// crypto.randomUUID for ids, per the repo convention.
//
// A photo's runtime `url` is an object URL that only exists in the current browser
// session, so it is NEVER persisted. `serializeProject` strips it and `hydratePhotos`
// re-attaches a fresh one from the stored blob.

import { DEFAULT_WHITESPACE, type AlbumPage, type Cover, type PageFormat, type Photo, type Spine } from "../types";
import {
  DEFAULT_COLOR_THEME,
  DEFAULT_FONT_THEME,
  colorThemeOrDefault,
  fontThemeOrDefault,
  type ColorThemeId,
  type FontThemeId,
} from "./themes";
import { DEFAULT_TEXT_SIZES, textSizesOrDefault, type TextSizes } from "./text-sizes";
import {
  DEFAULT_BOOK_SIZE,
  bookSizeForLegacyFormat,
  bookSizeOrDefault,
  type BookSizeId,
} from "./book-sizes";

export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: number; // ms epoch
  updatedAt: number; // ms epoch
}

/** A photo as persisted: everything except the ephemeral runtime object URL. */
export type StoredPhoto = Omit<Photo, "url">;

/** The full persisted document for one project. */
export interface ProjectDoc extends ProjectMeta {
  bookSize: BookSizeId;
  spine: Spine;
  fontTheme: FontThemeId;
  colorTheme: ColorThemeId;
  textSizes: TextSizes;
  photos: StoredPhoto[];
  pages: AlbumPage[];
  frontCover: Cover;
  insideFrontCover: Cover;
  insideBackCover: Cover;
  backCover: Cover;
}

/** The slice of live album state a project is serialized from. */
export interface ProjectState {
  id: string;
  name: string;
  createdAt: number;
  bookSize: BookSizeId;
  spine: Spine;
  fontTheme: FontThemeId;
  colorTheme: ColorThemeId;
  textSizes: TextSizes;
  photos: Photo[];
  pages: AlbumPage[];
  frontCover: Cover;
  insideFrontCover: Cover;
  insideBackCover: Cover;
  backCover: Cover;
}

/** The fields an older (pre-008) document may carry instead of `bookSize` / `spine`. */
type LegacyDocFields = { format?: PageFormat; bookSize?: BookSizeId; spine?: Spine };

/** The book size of a doc, migrating a legacy `format` when `bookSize` is absent. */
export function bookSizeOfDoc(doc: ProjectDoc): BookSizeId {
  const raw = doc as unknown as LegacyDocFields;
  return bookSizeOrDefault(raw.bookSize ?? bookSizeForLegacyFormat(raw.format)).id;
}

/** The spine of a doc, defaulting to an empty (auto) spine for older documents. */
export function spineOfDoc(doc: ProjectDoc): Spine {
  const raw = doc as unknown as LegacyDocFields;
  return { title: raw.spine?.title ?? "" };
}

/** A fresh empty spine (auto: shows the front cover title). */
export function newSpine(): Spine {
  return { title: "" };
}

/** The spine title actually shown: the override, else the front cover title. */
export function effectiveSpineTitle(spine: Spine, frontCover: Cover): string {
  return spine.title.trim() || frontCover.title.trim();
}

/** A fresh, empty cover (no text, no photo). */
export function newCover(): Cover {
  return { title: "", subtitle: "", photoId: null, whitespace: DEFAULT_WHITESPACE };
}

/** A cover, defaulted when a document predates covers (backward compatibility). */
export function coverOrDefault(cover: Cover | undefined | null): Cover {
  // Coalesce photoId after the spread so an explicit `undefined` never leaks past
  // the declared `string | null`.
  return cover ? { ...newCover(), ...cover, photoId: cover.photoId ?? null } : newCover();
}

/** Clear a cover's photo reference when its photo is no longer present. */
export function cleanCover(cover: Cover, existingPhotoIds: Set<string>): Cover {
  if (cover.photoId && !existingPhotoIds.has(cover.photoId)) {
    return { ...cover, photoId: null };
  }
  return cover;
}

/**
 * A brand-new empty project document. It starts with no pages: the empty state is
 * shown until the first import, which distributes photos into fresh pages (matching
 * the store's initial pages: [] behavior).
 */
export function newProjectDoc(name: string, now: number): ProjectDoc {
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    bookSize: DEFAULT_BOOK_SIZE,
    spine: newSpine(),
    fontTheme: DEFAULT_FONT_THEME,
    colorTheme: DEFAULT_COLOR_THEME,
    textSizes: { ...DEFAULT_TEXT_SIZES },
    photos: [],
    pages: [],
    frontCover: newCover(),
    insideFrontCover: newCover(),
    insideBackCover: newCover(),
    backCover: newCover(),
  };
}

/** Serialize live album state into a persistable doc, stripping every photo url. */
export function serializeProject(state: ProjectState, now: number): ProjectDoc {
  return {
    id: state.id,
    name: state.name,
    createdAt: state.createdAt,
    updatedAt: now,
    bookSize: state.bookSize,
    spine: { ...state.spine },
    fontTheme: state.fontTheme,
    colorTheme: state.colorTheme,
    textSizes: { ...state.textSizes },
    // Strip the runtime object URL; keep native size, ratio, caption, placement.
    photos: state.photos.map(({ url: _url, ...rest }) => rest),
    pages: state.pages.map((pg) => ({ ...pg, photoIds: [...pg.photoIds] })),
    frontCover: { ...state.frontCover },
    insideFrontCover: { ...state.insideFrontCover },
    insideBackCover: { ...state.insideBackCover },
    backCover: { ...state.backCover },
  };
}

/**
 * Re-attach a runtime object URL to each stored photo via `urlFor`. A photo whose
 * blob is missing (urlFor returns undefined) is dropped so a broken image can never
 * crash the load.
 */
export function hydratePhotos(
  doc: ProjectDoc,
  urlFor: (photoId: string) => string | undefined,
): Photo[] {
  const photos: Photo[] = [];
  for (const sp of doc.photos) {
    const url = urlFor(sp.id);
    if (url === undefined) continue;
    photos.push({ ...sp, url });
  }
  return photos;
}

/** Meta view of a doc, for the project switcher list. */
export function metaOf(doc: ProjectDoc): ProjectMeta {
  return { id: doc.id, name: doc.name, createdAt: doc.createdAt, updatedAt: doc.updatedAt };
}

/**
 * Copy a doc under a new project id and name, remapping photo ids through
 * `photoIdMap` so the copy owns independent image blobs (the caller copies each blob
 * from the old id to the new one). Pages are deep-copied and their photoIds remapped.
 */
export function duplicateDoc(
  doc: ProjectDoc,
  opts: { id: string; name: string; now: number; photoIdMap: Map<string, string> },
): ProjectDoc {
  const remap = (id: string) => opts.photoIdMap.get(id) ?? id;
  const remapCover = (c: Cover): Cover => ({
    ...c,
    photoId: c.photoId ? remap(c.photoId) : null,
  });
  return {
    id: opts.id,
    name: opts.name,
    createdAt: opts.now,
    updatedAt: opts.now,
    bookSize: bookSizeOfDoc(doc),
    spine: spineOfDoc(doc),
    fontTheme: fontThemeOrDefault(doc.fontTheme).id,
    colorTheme: colorThemeOrDefault(doc.colorTheme).id,
    textSizes: textSizesOrDefault(doc.textSizes),
    photos: doc.photos.map((p) => ({ ...p, id: remap(p.id) })),
    pages: doc.pages.map((pg) => ({ ...pg, photoIds: pg.photoIds.map(remap) })),
    frontCover: remapCover(coverOrDefault(doc.frontCover)),
    insideFrontCover: remapCover(coverOrDefault(doc.insideFrontCover)),
    insideBackCover: remapCover(coverOrDefault(doc.insideBackCover)),
    backCover: remapCover(coverOrDefault(doc.backCover)),
  };
}
