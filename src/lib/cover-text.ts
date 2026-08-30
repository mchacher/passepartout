// Visibility of a cover face's editable text fields (issue 119), pure.
//
// A cover face edits its title and subtitle directly on the sheet, inside a FIXED top band
// (see print.ts): the band's height depends only on whether a title / subtitle exists, never on
// the font size, so enlarging the title never shrinks the photo. An <input> however keeps its
// natural height whether it holds a value or not, so an EMPTY field's placeholder falls below
// the band the sheet reserved for it and paints over the photo. The book preview and the PDF
// only draw text that exists, so neither ever showed it: the editor was alone in doing so.
//
// The rule: a field holding a value is always visible, an empty one is transparent at rest and
// revealed by hovering the cover face or focusing the field. A transparent field still takes
// clicks and still tabs, so nothing about editing changes.

/** Classes hiding an empty field at rest, behind the cover face's hover and its own focus. */
const GHOST = "opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100";

/**
 * The extra classes for one cover text field, from its current value. Empty (or blank) hides
 * the placeholder until hover or focus; anything else adds nothing.
 */
export function coverTextFieldClass(value: string): string {
  return value.trim().length > 0 ? "" : GHOST;
}
