// Text measurement for notes (spec 039). IMPURE by nature: it reads the browser's font
// metrics through a canvas 2d context, which is why it sits here and not in src/lib/.
//
// The pure line breaker (`wrapLines` in src/lib/notes.ts) takes a `measure` callback; on
// screen that callback comes from here, in the PDF painter it comes from the embedded
// font. Both read the SAME font file (see src/lib/note-fonts.ts), and notes are drawn with
// kerning and ligatures off (`.note-type` in src/index.css, `fontKerning = "none"` below)
// because pdf-lib neither measures nor draws kerned text. That is what makes a note break
// its lines at the same word in the editor and on paper.

import { noteFontById, noteFontFace } from "./lib/note-fonts";

let ctx: CanvasRenderingContext2D | null | undefined;

function context(): CanvasRenderingContext2D | null {
  if (ctx !== undefined) return ctx;
  try {
    ctx = document.createElement("canvas").getContext("2d");
  } catch {
    ctx = null; // no canvas (a very old browser, a hostile environment): fall back below
  }
  return ctx;
}

export interface NoteFaceSpec {
  font: string | undefined;
  sizePx: number;
  bold?: boolean;
  italic?: boolean;
}

/** The CSS `font` shorthand for a note face, used both to measure and to load it. */
export function noteFontCss({ font, sizePx, bold, italic }: NoteFaceSpec): string {
  const family = noteFontById(font);
  const face = noteFontFace(font, { bold, italic });
  const style = face.style === "italic" ? "italic " : "";
  return `${style}${face.weight} ${sizePx}px ${family.stack}`;
}

/**
 * A measuring function for one note face. Returns the natural advance width in px, with
 * kerning off. Tracking (the small-caps treatment) is added by `measureTracked`, not here,
 * so the same arithmetic runs on screen and in the painter.
 *
 * If canvas is unavailable the fallback estimates half an em per character: the note still
 * renders and wraps, just less exactly, which beats crashing the editor.
 */
export function noteMeasurer(spec: NoteFaceSpec): (s: string) => number {
  const c = context();
  if (!c) return (s: string) => s.length * spec.sizePx * 0.5;
  const font = noteFontCss(spec);
  return (s: string) => {
    c.font = font;
    c.fontKerning = "none";
    return c.measureText(s).width;
  };
}

/**
 * Resolve once the face is actually available, so the first measurement is not taken
 * against a fallback family. Resolves immediately where the Font Loading API is missing.
 */
export function loadNoteFace(spec: NoteFaceSpec): Promise<unknown> {
  try {
    if (!document.fonts?.load) return Promise.resolve(null);
    return document.fonts.load(noteFontCss(spec)).catch(() => null);
  } catch {
    return Promise.resolve(null);
  }
}
