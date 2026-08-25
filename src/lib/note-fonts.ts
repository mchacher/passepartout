// The note font catalog (spec 039), pure and framework-free, the same shape as the layout
// and album-theme catalogs: a small curated set a note picks by id.
//
// Unlike the album font themes (src/lib/themes.ts), which are SYSTEM font stacks, every
// family here is SHIPPED with the app as a real file. That is the whole point: a system font
// cannot be embedded in a PDF, so the export substitutes Times / Helvetica / Courier for it
// (see issue #99). A note has to land at an exact spot with exact line breaks, so the screen
// and the painter must read the same font file. `assetUrl` below is that file, declared by
// `@font-face` in src/index.css AND embedded by @pdf-lib/fontkit at export time.
//
// All six families are OFL licensed; each ships its licence next to the font in
// src/assets/fonts/.

import garamondRegular from "../assets/fonts/ebgaramond-regular.ttf?url";
import garamondItalic from "../assets/fonts/ebgaramond-italic.ttf?url";
import garamondBold from "../assets/fonts/ebgaramond-bold.ttf?url";
import playfairRegular from "../assets/fonts/playfair-regular.ttf?url";
import playfairItalic from "../assets/fonts/playfair-italic.ttf?url";
import playfairBold from "../assets/fonts/playfair-bold.ttf?url";
import latoRegular from "../assets/fonts/lato-regular.ttf?url";
import latoItalic from "../assets/fonts/lato-italic.ttf?url";
import latoBold from "../assets/fonts/lato-bold.ttf?url";
import quicksandRegular from "../assets/fonts/quicksand-regular.ttf?url";
import quicksandBold from "../assets/fonts/quicksand-bold.ttf?url";
import courierRegular from "../assets/fonts/courierprime-regular.ttf?url";
import courierItalic from "../assets/fonts/courierprime-italic.ttf?url";
import courierBold from "../assets/fonts/courierprime-bold.ttf?url";
import caveatRegular from "../assets/fonts/caveat-regular.ttf?url";
import caveatBold from "../assets/fonts/caveat-bold.ttf?url";

export type NoteFontId = "garamond" | "playfair" | "lato" | "quicksand" | "courier" | "caveat";

/** A face key: which shipped file a family + style combination resolves to. */
export type NoteFaceKey = "regular" | "italic" | "bold" | "boldItalic";

export interface NoteFace {
  /** The file both the browser and the PDF painter read. */
  assetUrl: string;
  /** The CSS font-weight this face is declared at in src/index.css. */
  weight: 400 | 700;
  /** The CSS font-style this face is declared at. */
  style: "normal" | "italic";
}

export interface NoteFont {
  id: NoteFontId;
  /** Shown in the picker. The real family name, because the user is choosing a typeface. */
  name: string;
  /** The CSS font-family value: the shipped family first, then a system fallback. */
  stack: string;
  /** The faces this family actually ships. `regular` is always present. */
  faces: Partial<Record<NoteFaceKey, NoteFace>> & { regular: NoteFace };
}

const face = (assetUrl: string, weight: 400 | 700, style: "normal" | "italic"): NoteFace => ({
  assetUrl,
  weight,
  style,
});

export const NOTE_FONTS: NoteFont[] = [
  {
    id: "garamond",
    name: "EB Garamond",
    stack: `"EB Garamond", Georgia, "Iowan Old Style", serif`,
    faces: {
      regular: face(garamondRegular, 400, "normal"),
      italic: face(garamondItalic, 400, "italic"),
      bold: face(garamondBold, 700, "normal"),
    },
  },
  {
    id: "playfair",
    name: "Playfair Display",
    stack: `"Playfair Display", Georgia, serif`,
    faces: {
      regular: face(playfairRegular, 400, "normal"),
      italic: face(playfairItalic, 400, "italic"),
      bold: face(playfairBold, 700, "normal"),
    },
  },
  {
    id: "lato",
    name: "Lato",
    stack: `"Lato", system-ui, -apple-system, "Segoe UI", sans-serif`,
    faces: {
      regular: face(latoRegular, 400, "normal"),
      italic: face(latoItalic, 400, "italic"),
      bold: face(latoBold, 700, "normal"),
    },
  },
  {
    id: "quicksand",
    name: "Quicksand",
    stack: `"Quicksand", ui-rounded, "SF Pro Rounded", system-ui, sans-serif`,
    faces: {
      regular: face(quicksandRegular, 400, "normal"),
      bold: face(quicksandBold, 700, "normal"),
    },
  },
  {
    id: "courier",
    name: "Courier Prime",
    stack: `"Courier Prime", "Courier New", ui-monospace, monospace`,
    faces: {
      regular: face(courierRegular, 400, "normal"),
      italic: face(courierItalic, 400, "italic"),
      bold: face(courierBold, 700, "normal"),
    },
  },
  {
    id: "caveat",
    name: "Caveat",
    stack: `"Caveat Note", "Segoe Script", "Snell Roundhand", cursive`,
    faces: {
      regular: face(caveatRegular, 400, "normal"),
      bold: face(caveatBold, 700, "normal"),
    },
  },
];

export const DEFAULT_NOTE_FONT: NoteFontId = "garamond";

/** The font for an id, or the default for an unknown / missing one. */
export function noteFontById(id: string | undefined | null): NoteFont {
  return NOTE_FONTS.find((f) => f.id === id) ?? NOTE_FONTS.find((f) => f.id === DEFAULT_NOTE_FONT)!;
}

/** Whether this family ships an italic face (the control is disabled when it does not). */
export function hasItalic(id: string | undefined | null): boolean {
  return noteFontById(id).faces.italic !== undefined;
}

/**
 * The shipped face for a family plus a style. A missing combination falls back to the
 * nearest face this family really has, never to a synthesized one: the browser and the
 * painter must agree, and the painter cannot fake an oblique.
 */
export function noteFontFace(
  id: string | undefined | null,
  opts: { bold?: boolean; italic?: boolean } = {},
): NoteFace {
  const font = noteFontById(id);
  const { faces } = font;
  if (opts.bold && opts.italic) return faces.boldItalic ?? faces.bold ?? faces.italic ?? faces.regular;
  if (opts.bold) return faces.bold ?? faces.regular;
  if (opts.italic) return faces.italic ?? faces.regular;
  return faces.regular;
}

/** Every distinct face in the catalog, for the `@font-face` declarations and the export. */
export function allNoteFaces(): { font: NoteFont; key: NoteFaceKey; face: NoteFace }[] {
  const out: { font: NoteFont; key: NoteFaceKey; face: NoteFace }[] = [];
  for (const font of NOTE_FONTS) {
    for (const key of ["regular", "italic", "bold", "boldItalic"] as NoteFaceKey[]) {
      const f = font.faces[key];
      if (f) out.push({ font, key, face: f });
    }
  }
  return out;
}
