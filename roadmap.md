# Roadmap

Tracked feature ideas for Passepartout. Written in English (repo convention). The
authoritative "how it's built" reference stays in `docs/architecture.md`; per-feature
designs live under `specs/`.

## Shipped

- Page layouts + whitespace engine (spec 001), projects/persistence (002), covers (003)
- Album theme: font + color palette (004), text size (005), cover/page text styles +
  page subtitle + XL (006)
- Reorder pages + page navigator rail (007)
- Real Blurb book sizes + spine (008)
- Print-ready PDF export: cover wrap + interior, 300 DPI, sRGB, bleed; spine carries the
  title or title + subtitle (009)
- Larger photos: tighter whitespace levers + photos maximized by default (spec 010)
- In-app book preview: read-through in double-page spreads, thumbnail rail, reuses the
  pure engine, read-only (spec 011)
- Full-page photos: per-page Fit (no crop) / Fill (crop) on single-photo pages, with a
  draggable crop focus for Fill; no-crop is the default (spec 012)
- Grid layout substrate (spec 013, Phase A): the catalog rests on a fixed 12 x 12 grid
  (templates are `CellRect`s); groundwork for free placement on the same model
- Free placement (spec 013, Phase B): a per-page "Edit layout" mode to move and resize
  photos on the grid, overlap them with a front/back stacking order, writing a custom
  `placement`; never crops
- Photo crop tool (spec 015): a Crop button (in Edit layout) opens a free crop rectangle on
  the photo; the kept region lays out by its effective ratio and renders/prints everywhere.
  No-crop stays the default
- Bigger cover photo: the cover header now lives in a fixed top band (like the interior
  pages), so the title size no longer shrinks the photo and a subtitle-less cover gives that
  space back to the photo, at every font size; cover margins tightened from 9% to 6%
- Editor zoom (spec 016): a bottom-right slider scales the central page cards for easier
  editing; the Library and thumbnail rail keep their size, and it only scales the display so
  photos stay contained and never cropped
- Reuse a photo across pages (spec 017): a photo can appear on several pages / cover faces
  at once (no more single `pageId`, usage is derived); the Library badges each photo with
  its usage count and filters to the unused ones
- Decorative photo masks (spec 018): an opt-in per-photo shape (oval, rounded, arch) from an
  enrichable catalog; the mask follows the photo's box and only hides the outside-shape
  pixels, so the ratio/size are unchanged. No mask is the default; the engine is untouched
- Decorative photo frames (spec 019): an opt-in per-photo mat from an enrichable catalog and
  color palette. Border keeps the photo whole in a uniform border of a selectable width
  (additive, never clips); Polaroid shows it in a square, Shift-pannable, cover-cropped
  window over a bottom band that holds an optional handwritten note (a bundled handwriting
  font, embedded in the PDF via @pdf-lib/fontkit). No rounded corners; the engine is untouched

## Requested (this round)

1. **Grid free placement, Phase C** (later). Adjustable grid resolution, multi-select /
   group move, and spanning a single photo across a double-page spread. Phases A (grid
   substrate) and B (move/resize/overlap editor) have shipped.

2. **Image editing (crop / format / masks / frames).**
   > **Largely delivered.** The opt-in path the caveat below suggests now exists: full-page
   > Fill (spec 012), the per-photo crop tool (spec 015), decorative masks (spec 018) and
   > additive frames (spec 019, which never clip) all decorate only where the user explicitly
   > opts in, no-crop staying the default. What remains is forced-format presets (a fixed
   > aspect that would change the ratio) and richer mask / frame variants.
   > ⚠️ **Direct tension with the founding rule.** The product's one rule is *"a photo's
   > aspect ratio is never changed and a photo is never clipped"* (see `CLAUDE.md`). Crop
   > and masks clip the photo; a forced format changes its ratio. Recording this as
   > requested, but adopting it is a **deliberate product-direction decision**, not a
   > normal feature: it changes what Passepartout is. If pursued, the cleanest path is to
   > keep no-crop as the default and make any crop/mask an **explicit, per-photo opt-in**
   > (so the engine's contain-fit guarantee still holds for every un-edited photo), and to
   > decide up front how an edited photo flows through the layout engine and the PDF
   > export. Worth an explicit conversation before it becomes a spec.

## Later (from earlier planning, see CLAUDE.md)

- **Host the project on GitHub.** The repo is currently local-only (no git remote). Create
  a GitHub repository under the owner's account and push `master` so the work is backed up
  and shareable (then future features can go via PRs instead of local merges).
- Embed the real album fonts in the PDF (today print maps each to Times / Helvetica /
  Courier). The embedding infrastructure now exists (spec 019 embeds a handwriting font via
  @pdf-lib/fontkit), so this is mostly wiring the album font files through the same path.
- More imprimeur presets (CEWE / Saal Digital, etc.). Blurb trim sizes already ship.
- Full-bleed / spread templates (one photo across a double page) while still never
  cropping.
- Reorder photos within a page by drag (reordering whole pages already ships, spec 007).
- Project file export/import (a portable backup on top of the IndexedDB persistence).
