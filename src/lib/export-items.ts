// Turning a stored Photo into what the PDF painter draws (pure).
//
// The export used to build this shape three times by hand in ExportPanel: once for a page
// photo, once for an inside cover face and once for an outside cover face. Only the page
// mapping carried the decorations, so a mask, a frame or a tilt on a cover face was shown by
// the editor and by the book preview, then silently dropped from the printed book (issue #121).
// One function now answers for all three, and adding a decoration means adding it here.

import type { ExportItem } from "./pdf-export";
import { effectiveRatio } from "./crop";
import { photoLayoutRatio } from "./frames";
import type { Photo } from "../types";

/**
 * One export item for a placed photo.
 *
 * `ratio` is the LAYOUT ratio, the frame's outer ratio when the photo is framed, so the box the
 * geometry reserves has the shape of what will be drawn in it. `fullPage` is spec 012: the photo
 * is cover-cropped to the whole page, which ignores the per-photo crop and every decoration on
 * screen, so the export drops them too and sends the source ratio.
 */
export function exportItem(p: Photo, caption: string, fullPage = false): ExportItem {
  return {
    photoId: p.id,
    ratio: fullPage ? p.ratio : photoLayoutRatio(p),
    photoRatio: effectiveRatio(p.ratio, p.crop),
    sourceRatio: p.ratio,
    url: p.url,
    caption,
    crop: fullPage ? undefined : p.crop,
    mask: fullPage ? undefined : p.mask,
    maskRadius: fullPage ? undefined : p.maskRadius,
    frame: fullPage ? undefined : p.frame,
    frameColor: fullPage ? undefined : p.frameColor,
    frameText: fullPage ? undefined : p.frameText,
    frameWidth: fullPage ? undefined : p.frameWidth,
    frameFocus: fullPage ? undefined : p.frameFocus,
    rotation: fullPage ? undefined : p.rotation,
  };
}

/** The single photo of a cover face: a placed photo with no caption. */
export function exportCoverItem(p: Photo): ExportItem {
  return exportItem(p, "");
}
