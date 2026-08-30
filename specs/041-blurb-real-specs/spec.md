# 041 - Print provider specifications

## Context

Specs 008 and 009 built the print path on Blurb's **marketing** book names: "Standard
Landscape 10x8" was encoded as a 254 x 203.2 mm trim, bleed was added symmetrically on all
four sides, and the cover wrap was `2 x trim + spine`. Blurb's PDF to Book preflight rejects
every file that comes out of that model (issue #114): wrong page size, wrong cover size, and
an odd page count.

The numbers Blurb actually wants come from its own specification calculator, per book size,
cover type, paper and page count. Blurb says so explicitly: use the calculator, do not derive
bleed from the trim yourself. This spec replaces our derived arithmetic with that table.

It also generalises it. The roadmap has always had CEWE and Saal Digital on it, and printers
disagree on things that look universal: which edges take the bleed, what a "10x8 book" trims
at, what a cover even is, how many pages are allowed and in what multiples. So the table is not
"the Blurb constants", it is a **print provider model**, and Blurb is its first entry. A second
printer is a new data file, not a refactor.

## Goals

- A `src/lib/print-provider.ts` model: what an album has to satisfy to be accepted by a
  printer, expressed as data. Per book size the **real trim**, the bleed and which edges take
  it, and the safe insets; per (size, cover construction) the overhang, bleed, flaps and spine;
  and per provider the page count rule and the target resolution. Pure, with pure accessors.
- `src/lib/provider-blurb.ts`: Blurb's numbers, harvested from its calculator, and
  `src/lib/print-providers.ts`, the registry a `BookSize.provider` resolves against.
- `BOOK_SIZES` trims sourced from that catalog, so the on-screen page ratio finally equals the
  printed page (the promise of spec 008).
- An interior PDF whose page size is `trim + 0.125 in` wide and `trim + 0.25 in` tall, with the
  bleed on the **outside** edge and the trim box flush against the binding edge, alternating
  by page index.
- A cover wrap that matches the selected **cover type**: softcover, hardcover with dust jacket
  (two flaps), hardcover ImageWrap (board overhang, wider bleed).
- An interior page count that is always **even**, and a warning below Blurb's 20 page minimum.
- An export panel that states the exact target dimensions, so a mismatch is visible before the
  upload rather than after.

## Non-goals

- No other print provider yet. CEWE and Saal Digital stay on the roadmap; this spec makes the
  provider dimension explicit enough that adding one is data, not surgery.
- No automatic re-layout migration. Correcting a trim changes an album's page ratio, and the
  layout engine re-fits from it as it always does. Photos are re-fitted, never cropped, so the
  one rule still holds.
- No paper caliper modelling. The spine comes from Blurb's table, with the manual override kept.

## The one rule

Untouched. Correcting the trim changes the size of the region a photo is contained in; the
photo is still contain-fit inside it at its own ratio. Nothing here lets the engine crop.

## Requirements

### The model (`src/lib/print-provider.ts`, pure)

- `PageSpec`: `trimIn`, `bleedIn`, `bleedEdges` (`outer-three` or `all`), `safeOuterIn`,
  `safeBindingIn`.
- `CoverSpec`: `id`, `labelKey`, `overhangIn`, `bleedIn`, `flapIn`, and `spineIn` sampled by
  page count per paper family.
- `PrintProvider`: `pageCount` (`multipleOf`, `min`, `max`), `dpi`, the page table and the
  cover table, plus the `specUrl` a reader can check the numbers against.
- `pageMediaIn(spec)` adds the bleed to the edges that take one: with `outer-three` that is one
  bleed horizontally and two vertically. Verified equal to the calculator's "Final, exported
  PDF should measure" for every size.
- `coverMediaIn(page, cover, spineIn)` and `spineWidthIn(cover, paper, pages)` likewise for the
  wrap, and `roundUpPageCount(rule, pages)` for the padding.
- `scripts/harvest-blurb-specs.mjs` regenerates the Blurb tables, so they can be refreshed when
  Blurb changes a size and the test data stays reproducible.

### Print geometry (`src/lib/print.ts`)

- `interiorPageGeometry` takes a `bindingSide: "left" | "right"`. Media box from
  `pageMediaIn`; with `outer-three` the trim box sits at `x = 0` when the binding edge is on
  the left (bleed on the right) and at `x = bleed` when it is on the right. A provider that
  bleeds all four edges gets one on each side, unchanged.
- `coverWrapGeometry` takes the `CoverSpec`. Back and front panels sit inside the wrap at the
  cover's own overhang, the spine panel between them, flaps outside them when there are flaps.

### Export (`src/components/ExportPanel.tsx`)

- Cover construction selector, listing what the provider offers for that size. Panel state,
  like the paper and the spine override already are (spec 009): it is a property of the order,
  not of the album.
- Interior page count shown with its parity fix applied, and the blank leaf inserted before the
  inside back cover when the count is odd.
- The target page and cover dimensions displayed in inches, next to what we will actually emit.
- A warning under 20 interior pages.

## Acceptance criteria

- [ ] For every size and cover type, the emitted PDF media boxes equal Blurb's "Final, exported
      PDF should measure" values, asserted in tests.
- [ ] The interior PDF always has an even page count.
- [ ] A page's bleed is on its outside edge, and the binding side alternates.
- [ ] The on-screen page ratio equals the real trim ratio.
- [ ] The Corse 2026 album passes Blurb preflight end to end.

## Edge cases

- **Cover construction unavailable for a size** (softcover is not offered above a certain
  format, and a row we have not measured is absent too): the selector does not list it, and the
  cover export is disabled rather than emitting a guessed wrap.
- **Spine override**: still wins over the table, unchanged behaviour.
- **Existing projects**: they keep their size id and pick up the corrected trim, so their pages
  re-fit. Nothing is lost; no photo is cropped.
- **Odd page count**: blank leaves, never a duplicated page, and inserted before the inside
  back cover rather than after it.
