// What a standard PDF font can print (issue 75). Pure.
//
// pdf-lib's standard fonts (Times, Helvetica, Courier) encode WinAnsi, that is CP1252. The
// export used to filter on the Latin-1 RANGE instead (\x00-\xff), which is not the same set:
// CP1252 fills the 0x80..0x9F block that Latin-1 leaves as control codes, and that block
// holds the French ligature, the curly quotes, the long dashes and the ellipsis. Filtering on
// the range therefore dropped characters the font could print: `coeur` typed with the
// ligature came out as "cur".
//
// The repertoire is spelled out rather than computed: CP1252 is a frozen standard, an explicit
// table is easy to check against it, and a clever regex is not.

/** The 27 characters CP1252 puts in 0x80..0x9F, which Latin-1 leaves undefined. */
export const CP1252_EXTRAS = [
  "€", // 0x80 euro sign
  "‚", // 0x82 single low quotation mark
  "ƒ", // 0x83 latin small letter f with hook
  "„", // 0x84 double low quotation mark
  "…", // 0x85 horizontal ellipsis
  "†", // 0x86 dagger
  "‡", // 0x87 double dagger
  "ˆ", // 0x88 modifier letter circumflex accent
  "‰", // 0x89 per mille sign
  "Š", // 0x8A latin capital letter s with caron
  "‹", // 0x8B single left-pointing angle quotation mark
  "Œ", // 0x8C latin capital ligature oe
  "Ž", // 0x8E latin capital letter z with caron
  "‘", // 0x91 left single quotation mark
  "’", // 0x92 right single quotation mark
  "“", // 0x93 left double quotation mark
  "”", // 0x94 right double quotation mark
  "•", // 0x95 bullet
  "–", // 0x96 en dash
  "—", // 0x97 em dash
  "˜", // 0x98 small tilde
  "™", // 0x99 trade mark sign
  "š", // 0x9A latin small letter s with caron
  "›", // 0x9B single right-pointing angle quotation mark
  "œ", // 0x9C latin small ligature oe
  "ž", // 0x9E latin small letter z with caron
  "Ÿ", // 0x9F latin capital letter y with diaeresis
] as const;

const EXTRAS = new Set<string>(CP1252_EXTRAS);

/**
 * Whether a standard PDF font can print this character: printable ASCII, the printable
 * Latin-1 supplement, or one of the CP1252 extras. Control characters are NOT printable, and
 * neither are the five slots CP1252 leaves undefined (0x81, 0x8D, 0x8F, 0x90, 0x9D): both fall
 * out of the ranges below without needing a special case.
 */
export function isWinAnsiPrintable(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  if (code >= 0x20 && code <= 0x7e) return true; // printable ASCII
  if (code >= 0xa0 && code <= 0xff) return true; // printable Latin-1 supplement
  return EXTRAS.has(ch);
}

/**
 * Drop every character a standard PDF font cannot print, so an exotic one (an emoji, CJK)
 * can never throw mid-export. Astral characters are handled by iterating code points, so a
 * surrogate half is never left behind.
 *
 * The handwritten Polaroid note does NOT go through here: it is drawn with the embedded
 * Caveat font, which has its own repertoire and its own error handling.
 */
export function winAnsiSafe(text: string): string {
  let out = "";
  for (const ch of text) if (isWinAnsiPrintable(ch)) out += ch;
  return out;
}
