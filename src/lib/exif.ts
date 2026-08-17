// Best-effort EXIF capture-time reader.
//
// Vacation photos should order themselves by when they were taken, not by when
// the file happened to land on disk. We read the EXIF `DateTimeOriginal`
// (tag 0x9003) straight from the JPEG bytes. Anything unexpected -> return null
// and the caller falls back to the file's lastModified. Never throws.

/** Returns capture time in ms since epoch, or null if not found. */
export function readCaptureTime(buffer: ArrayBuffer): number | null {
  try {
    const view = new DataView(buffer);
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null; // not a JPEG

    let offset = 2;
    while (offset + 4 <= view.byteLength) {
      if (view.getUint8(offset) !== 0xff) break;
      const marker = view.getUint8(offset + 1);
      const size = view.getUint16(offset + 2);
      if (marker === 0xe1) {
        // APP1 - may hold the EXIF TIFF block
        const start = offset + 4;
        if (view.getUint32(start) === 0x45786966) {
          // "Exif"
          const date = parseExifDate(view, start + 6);
          if (date) return date;
        }
      }
      if (marker === 0xda) break; // start of scan, no metadata past here
      offset += 2 + size;
    }
    return null;
  } catch {
    return null;
  }
}

function parseExifDate(view: DataView, tiffStart: number): number | null {
  const le = view.getUint16(tiffStart) === 0x4949; // "II" little-endian, else "MM"
  const u16 = (o: number) => view.getUint16(o, le);
  const u32 = (o: number) => view.getUint32(o, le);

  const ifd0 = tiffStart + u32(tiffStart + 4);
  const exifIfdOffset = findTag(ifd0, 0x8769, u16, u32);
  if (exifIfdOffset === null) return null;

  const exifIfd = tiffStart + exifIfdOffset;
  const strOffset = findTag(exifIfd, 0x9003, u16, u32);
  if (strOffset === null) return null;

  // ASCII "YYYY:MM:DD HH:MM:SS"
  const bytes: number[] = [];
  for (let i = 0; i < 19; i++) bytes.push(view.getUint8(tiffStart + strOffset + i));
  const s = String.fromCharCode(...bytes);
  const m = s.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi, se] = m.map(Number) as unknown as number[];
  const t = new Date(y, mo - 1, d, h, mi, se).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * Read an IFD, find `tag`, and return its value offset (for a pointer/offset
 * tag) relative to tiffStart. Handles only the LONG/pointer case we need.
 */
function findTag(
  ifd: number,
  tag: number,
  u16: (o: number) => number,
  u32: (o: number) => number,
): number | null {
  const count = u16(ifd);
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12;
    if (u16(entry) === tag) {
      // For 0x8769 the value is a LONG offset; for 0x9003 it's an ASCII string
      // whose (>4 byte) data lives at the offset in the last 4 bytes. Both cases
      // give us an offset relative to tiffStart in the entry's value field.
      return u32(entry + 8);
    }
  }
  return null;
}
