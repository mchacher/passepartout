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

## Requested (this round)

1. **In-app book preview.** A read-through preview of the whole book inside the web
   interface (turn/scroll the pages as they will print), distinct from the editor and
   from the PDF. Reuses the same pure engine numbers as `Paper` / `Thumb` / `print.ts`.

2. **Full-page photos.** A way to let a photo fill the whole page (edge to edge /
   full-bleed), for the "one big photo per page" look.
   > **No-crop caveat.** A photo can only fill the *entire* page without cropping when
   > its ratio matches the page's; otherwise full-page means either cropping (conflicts
   > with the founding rule) or letterboxing (not truly full-page). Ways to reconcile,
   > to decide when this becomes a spec: (a) full-bleed only when the photo ratio is
   > close enough to the page, else contain-fit; (b) an explicit per-photo full-bleed opt-in
   > that accepts a crop (ties into item 5); (c) let the page adapt toward the photo's
   > ratio. Related to the shipped "maximize photos" (010) and to free placement (3).

3. **Free placement.** Let a photo be positioned freely on the page rather than only in
   the fixed layout-template regions. This is a significant model change: today a page is
   a `layoutId` (a nested split tree) and the engine derives regions from it. Free
   placement means per-photo position/size on the page (a new placement model alongside,
   or instead of, templates). Design carefully so it coexists with the existing layouts.

4. **Image editing (crop / format / masks).**
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
