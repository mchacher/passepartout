// The shipped font catalog (spec 039 for notes, spec 040 for the album), pure and
// framework-free, the same shape as the layout catalog: a small curated set picked by id.
//
// Every family here is SHIPPED with the app as a real file, and that is the whole point. A
// system font cannot be embedded in a PDF, so an album set in Georgia used to print in Times
// and three of the five album voices collapsed onto Helvetica (issue #99). Text has to land
// at an exact spot with exact line breaks, so the screen and the painter must read the same
// file: `assetUrl` below is that file, declared by `@font-face` in src/index.css AND embedded
// by @pdf-lib/fontkit at export time. Nothing in the product is substituted any more.
//
// Both users of this catalog pick a family by id: a note carries one directly (spec 039), an
// album style names one (`FontTheme.family` in src/lib/themes.ts, spec 040).
//
// All seven families are OFL licensed; each ships its licence next to the font in
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
import cabinRegular from "../assets/fonts/cabin-regular.ttf?url";
import cabinItalic from "../assets/fonts/cabin-italic.ttf?url";
import cabinBold from "../assets/fonts/cabin-bold.ttf?url";

export type ShippedFontId =
  | "garamond"
  | "playfair"
  | "lato"
  | "cabin"
  | "quicksand"
  | "courier"
  | "caveat";

/** A face key: which shipped file a family + style combination resolves to. */
export type ShippedFaceKey = "regular" | "italic" | "bold" | "boldItalic";

export interface ShippedFace {
  /** The file both the browser and the PDF painter read. */
  assetUrl: string;
  /** The CSS font-weight this face is declared at in src/index.css. */
  weight: 400 | 700;
  /** The CSS font-style this face is declared at. */
  style: "normal" | "italic";
}

export interface ShippedFont {
  id: ShippedFontId;
  /** Shown in the picker. The real family name, because the user is choosing a typeface. */
  name: string;
  /** The CSS font-family value: the shipped family first, then a system fallback. */
  stack: string;
  /** The faces this family actually ships. `regular` is always present. */
  faces: Partial<Record<ShippedFaceKey, ShippedFace>> & { regular: ShippedFace };
}

const face = (assetUrl: string, weight: 400 | 700, style: "normal" | "italic"): ShippedFace => ({
  assetUrl,
  weight,
  style,
});

export const SHIPPED_FONTS: ShippedFont[] = [
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
    id: "cabin",
    name: "Cabin",
    stack: `"Cabin", Optima, Candara, "Gill Sans", system-ui, sans-serif`,
    faces: {
      regular: face(cabinRegular, 400, "normal"),
      italic: face(cabinItalic, 400, "italic"),
      bold: face(cabinBold, 700, "normal"),
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
    stack: `"Caveat", "Segoe Script", "Snell Roundhand", cursive`,
    faces: {
      regular: face(caveatRegular, 400, "normal"),
      bold: face(caveatBold, 700, "normal"),
    },
  },
];

export const DEFAULT_SHIPPED_FONT: ShippedFontId = "garamond";

/** The font for an id, or the default for an unknown / missing one. */
export function shippedFontById(id: string | undefined | null): ShippedFont {
  return SHIPPED_FONTS.find((f) => f.id === id) ?? SHIPPED_FONTS.find((f) => f.id === DEFAULT_SHIPPED_FONT)!;
}

/** Whether this family ships an italic face (the control is disabled when it does not). */
export function hasItalic(id: string | undefined | null): boolean {
  return shippedFontById(id).faces.italic !== undefined;
}

/**
 * The shipped face for a family plus a style. A missing combination falls back to the
 * nearest face this family really has, never to a synthesized one: the browser and the
 * painter must agree, and the painter cannot fake an oblique.
 */
export function shippedFontFace(
  id: string | undefined | null,
  opts: { bold?: boolean; italic?: boolean } = {},
): ShippedFace {
  const font = shippedFontById(id);
  const { faces } = font;
  if (opts.bold && opts.italic) return faces.boldItalic ?? faces.bold ?? faces.italic ?? faces.regular;
  if (opts.bold) return faces.bold ?? faces.regular;
  if (opts.italic) return faces.italic ?? faces.regular;
  return faces.regular;
}

/** Every distinct face in the catalog, for the `@font-face` declarations and the export. */
export function allShippedFaces(): { font: ShippedFont; key: ShippedFaceKey; face: ShippedFace }[] {
  const out: { font: ShippedFont; key: ShippedFaceKey; face: ShippedFace }[] = [];
  for (const font of SHIPPED_FONTS) {
    for (const key of ["regular", "italic", "bold", "boldItalic"] as ShippedFaceKey[]) {
      const f = font.faces[key];
      if (f) out.push({ font, key, face: f });
    }
  }
  return out;
}

/**
 * Drop the characters a face cannot draw. `has` answers whether the embedded font maps a
 * code point; anything it does not is removed rather than painted, because a TrueType face
 * renders an unmapped code point as its .notdef glyph, which in most of these families is a
 * visible hollow rectangle with a full advance width: it would both show a box in the
 * printed book and push the rest of the line off centre.
 *
 * This replaced the WinAnsi filter the standard PDF fonts needed (issue 75): the question is
 * no longer "is it in CP1252" but "does this face have it", which is a strictly larger
 * repertoire for every family the app ships.
 */
export function supportedText(text: string, has: (codePoint: number) => boolean): string {
  let out = "";
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    // A line break never reaches the painter, and a plain space is always mapped.
    if (cp === undefined || cp === 0x20 || has(cp)) out += ch;
  }
  return out;
}
