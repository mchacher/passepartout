// The print provider model (spec 041): what an album has to satisfy to be accepted by a
// printer, expressed as DATA so that adding a printer is a table, not a code change.
//
// It exists because deriving those numbers ourselves is exactly what broke the Blurb export
// (issue #114). Every printer publishes its own specifications, and they disagree on things
// that look universal:
//
//   - which edges take the bleed. Blurb adds it to the top, the bottom and the outside edge of
//     a page, never the gutter; plenty of printers add it to all four.
//   - what a "10x8 book" trims at. Blurb's is 9.5 x 8.0 in.
//   - what a cover is. A softcover trims flush with the block, a dust jacket adds two flaps, an
//     ImageWrap hardcover overhangs the block on every edge and bleeds wider.
//   - how many pages are allowed, and in what multiples.
//
// So a provider owns all of it, and `print.ts` reads the rule instead of assuming one. All
// lengths are INCHES, the unit printers publish in; `print.ts` converts to points.

/** Which edges of an interior page carry the bleed. */
export type PageBleedEdges =
  /** Top, bottom and the outside edge only. The binding edge is the gutter. */
  | "outer-three"
  /** All four edges. */
  | "all";

export interface PageSpec {
  /** The real trim, the finished page after cutting. Not the printer's marketing name. */
  trimIn: { w: number; h: number };
  bleedIn: number;
  bleedEdges: PageBleedEdges;
  /** Safe boundary inset on the top, bottom and outside edges. */
  safeOuterIn: number;
  /** Safe boundary inset on the binding edge, larger because content binds into the gutter. */
  safeBindingIn: number;
}

export interface SpinePoint {
  pages: number;
  width: number;
}

/** Paper families, as far as the spine is concerned. */
export type PaperFamily = "standard" | "premium";

export interface CoverSpec {
  /** Stable id, unique within the provider. */
  id: string;
  /** i18n key for the name the printer gives this construction. */
  labelKey: string;
  /**
   * How far one cover face extends beyond the page trim, per side. Zero when the cover trims
   * flush with the block; positive when the printed sheet wraps around a board.
   */
  overhangIn: { w: number; h: number };
  /** Bleed, added to all four sides of a cover. Often larger than a page's. */
  bleedIn: number;
  /** Flap width, from the trim edge to the fold. Zero when the cover has no flaps. */
  flapIn: number;
  /**
   * Spine width by interior page count, per paper family. Sampled points, interpolated in
   * between: a spine is piecewise linear in the page count, so a point every octave is enough.
   */
  spineIn: Record<PaperFamily, SpinePoint[]>;
}

export interface PageCountRule {
  /** The page count must be a multiple of this. */
  multipleOf: number;
  min: number;
  max: number;
}

export interface PrintProvider {
  id: string;
  name: string;
  /** Where the reader can check these numbers, and where the harvest script reads them from. */
  specUrl: string;
  pageCount: PageCountRule;
  dpi: number;
  /** Page specifications by our own book size id. */
  pages: Record<string, PageSpec>;
  /** Cover specifications by book size id, then by cover id. A size need not offer all of them. */
  covers: Record<string, Record<string, CoverSpec>>;
}

/**
 * The page size the printer's preflight demands: the trim plus its bleed, on the edges that
 * take one. With `outer-three` that is one bleed horizontally and two vertically, which is why
 * a page is not simply "trim plus bleed all round".
 */
export function pageMediaIn(spec: PageSpec): { w: number; h: number } {
  const sides = spec.bleedEdges === "all" ? 2 : 1;
  return { w: spec.trimIn.w + sides * spec.bleedIn, h: spec.trimIn.h + 2 * spec.bleedIn };
}

/**
 * The wrap the printer's preflight demands, given a spine width in inches.
 *
 *   face  = page trim + overhang
 *   trim  = 2 x (face + flap) + spine, by (page trim height + 2 x overhang)
 *   media = trim + bleed on all four sides
 */
export function coverMediaIn(page: PageSpec, cover: CoverSpec, spineIn: number): { w: number; h: number } {
  const faceW = page.trimIn.w + cover.overhangIn.w;
  const trimW = 2 * (faceW + cover.flapIn) + spineIn;
  const trimH = page.trimIn.h + 2 * cover.overhangIn.h;
  return { w: trimW + 2 * cover.bleedIn, h: trimH + 2 * cover.bleedIn };
}

/** The spine width for a page count, interpolated between the sampled points. */
export function spineWidthIn(cover: CoverSpec, paper: PaperFamily, pages: number): number {
  const pts = cover.spineIn[paper];
  if (pts.length === 0) return 0;
  if (pages <= pts[0].pages) return pts[0].width;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (pages <= b.pages) {
      const t = (pages - a.pages) / (b.pages - a.pages);
      return a.width + t * (b.width - a.width);
    }
  }
  return pts[pts.length - 1].width;
}

/** The next acceptable page count at or above `pages`, per the provider's multiple. */
export function roundUpPageCount(rule: PageCountRule, pages: number): number {
  const m = Math.max(1, rule.multipleOf);
  return Math.ceil(pages / m) * m;
}
