// Photo usage (spec 017), a pure helper. A photo can appear on any number of pages and
// cover faces; how many times it is used is derived here from the pages' photoIds and the
// cover photoIds, never from a back-reference on the photo. "Unused" (count 0) drives the
// Library filter and the count badge.

import type { AlbumPage } from "../types";

/**
 * Total appearances of each photo id across every page's `photoIds` and each non-null
 * cover photo id. Ids that never appear are simply absent from the map (count 0).
 */
export function countUsage(pages: AlbumPage[], coverPhotoIds: (string | null)[]): Map<string, number> {
  const map = new Map<string, number>();
  const bump = (id: string) => map.set(id, (map.get(id) ?? 0) + 1);
  for (const pg of pages) {
    for (const id of pg.photoIds) bump(id);
  }
  for (const id of coverPhotoIds) {
    if (id) bump(id);
  }
  return map;
}

/** How many times a photo id is used (0 when absent from the map). */
export function usageCount(map: Map<string, number>, id: string): number {
  return map.get(id) ?? 0;
}

/** True when a photo id is used nowhere. */
export function isUnused(map: Map<string, number>, id: string): boolean {
  return usageCount(map, id) === 0;
}
