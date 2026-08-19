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

## Requested (this round)

1. **Free placement** (spec 013 Phase B). Let a photo be moved and resized on the page,
   snapped to the 12 x 12 grid, writing a per-page `placement` that detaches from the
   named template. Phase A shipped the grid substrate; this adds the editor. (Phase C,
   later: adjustable grid resolution, overlaps, spanning a double-page spread.)

2. **Image editing (crop / format / masks).**
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

- Embed the real album fonts in the PDF (today print maps each to Times / Helvetica /
  Courier).
- More imprimeur presets (CEWE / Saal Digital, etc.). Blurb trim sizes already ship.
- Full-bleed / spread templates (one photo across a double page) while still never
  cropping.
- Reorder photos within a page by drag (reordering whole pages already ships, spec 007).
- Project file export/import (a portable backup on top of the IndexedDB persistence).
