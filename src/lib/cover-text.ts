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

// An empty field is also taken OUT of the flow, so it never adds a line to the block. An input
// keeps its natural height whether it holds a value or not, and the band is sized for the text
// that exists: with the band under the photo (spec 042) a phantom line pushed the real title up
// out of its band and onto the picture, which the book preview and the PDF never did because
// they only draw text that exists. `above` and `below` put the hidden placeholder back where its
// line would have been, for the moment a hover reveals it.
const ABOVE = "absolute inset-x-0 bottom-full";
const BELOW = "absolute inset-x-0 top-full";

export interface CoverTextFieldClasses {
  title: string;
  subtitle: string;
}

/**
 * The extra classes for a cover face's two text fields. A field holding a value adds nothing.
 * An empty one is hidden until hover or focus, and out of the flow so the block is exactly as
 * tall as the text it shows. A face with NO text at all keeps both fields in the flow: there is
 * no visible line for them to displace, and the two placeholders are all that says where to
 * type.
 */
export function coverTextFieldClasses(title: string, subtitle: string): CoverTextFieldClasses {
  const hasTitle = title.trim().length > 0;
  const hasSubtitle = subtitle.trim().length > 0;
  if (!hasTitle && !hasSubtitle) return { title: GHOST, subtitle: GHOST };
  return {
    title: hasTitle ? "" : `${GHOST} ${ABOVE}`,
    subtitle: hasSubtitle ? "" : `${GHOST} ${BELOW}`,
  };
}
