// Import de-duplication (issue 65), a pure helper. Importing the same folder twice used to
// double the library: every file became a new photo with its own id, its own usage badge and
// its own stored blob, and the copies were indistinguishable in the tray.
//
// Identity is derived from fields a Photo already carries, so existing projects need no
// migration and no new persisted field: the file name, the pixel dimensions, and the capture
// time (EXIF DateTimeOriginal when present, else the file's mtime). Two different shots never
// collide in practice: a burst shares a capture second but not a file name, and a resized copy
// does not share the dimensions. A copy that was RENAMED is deliberately not caught - that is
// the price of keeping the rule free of content hashing (unavailable over plain http anyway).

/** The fields identity is derived from: what an imported file contributes to a Photo. */
export interface PhotoIdentity {
  name: string;
  w: number;
  h: number;
  time: number;
}

/** The de-duplication key of a photo. Equal keys mean the same photo. */
export function photoKey(p: PhotoIdentity): string {
  return `${p.name}|${p.w}x${p.h}|${p.time}`;
}

/**
 * Split an incoming batch into the photos to add and the ones to skip. A photo is skipped when
 * its key matches one already in the library OR one kept earlier in the same batch, so a
 * selection holding the same file twice adds it once. Order is preserved and the first
 * occurrence always wins.
 */
export function splitDuplicates<T extends PhotoIdentity>(
  existing: readonly PhotoIdentity[],
  incoming: readonly T[],
): { kept: T[]; skipped: T[] } {
  const seen = new Set(existing.map(photoKey));
  const kept: T[] = [];
  const skipped: T[] = [];
  for (const item of incoming) {
    const key = photoKey(item);
    if (seen.has(key)) {
      skipped.push(item);
      continue;
    }
    seen.add(key);
    kept.push(item);
  }
  return { kept, skipped };
}
