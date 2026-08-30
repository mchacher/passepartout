# 041 - Real Blurb print specifications

## Context

Specs 008 and 009 built the print path on Blurb's **marketing** book names: "Standard
Landscape 10x8" was encoded as a 254 x 203.2 mm trim, bleed was added symmetrically on all
four sides, and the cover wrap was `2 x trim + spine`. Blurb's PDF to Book preflight rejects
every file that comes out of that model (issue #114): wrong page size, wrong cover size, and
an odd page count.

The numbers Blurb actually wants come from its own specification calculator, per book size,
cover type, paper and page count. Blurb says so explicitly: use the calculator, do not derive
bleed from the trim yourself. This spec replaces our derived arithmetic with that table.

## Goals

- A `src/lib/blurb-specs.ts` catalog holding, per book size, the **real trim**, the page bleed
  rule and the safe insets; and per (size, cover type) the cover trim, bleed, flaps and spine.
  Pure data plus pure accessors, unit tested against the values the calculator returns.
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

### Specification catalog (`src/lib/blurb-specs.ts`, pure)

- `BLURB_PAGE_SPECS`: per size id, `trimIn: {w, h}`, `bleedIn` (0.125), `safeOuterIn` (0.25),
  `safeBindingIn` (0.5 or 0.625 depending on size).
- `BLURB_COVER_SPECS`: per (size id, cover type), `trimIn: {w, h}` for the whole wrap at a
  reference page count, `bleedIn`, `flapIn`, and the spine table.
- `pageMediaIn(size)` returns `{w: trim.w + bleed, h: trim.h + 2 * bleed}`. Verified equal to
  the calculator's "Final, exported PDF should measure" for every size.
- `coverMediaIn(size, coverType, spineIn)` likewise for the wrap.
- The harvest script that produced the table lives in `scripts/harvest-blurb-specs.mjs`, so the
  table can be refreshed when Blurb changes a size, and the test data is reproducible.

### Print geometry (`src/lib/print.ts`)

- `interiorPageGeometry` takes a `bindingSide: "left" | "right"`. Media box from
  `pageMediaIn`; trim box at `x = 0` when the binding edge is on the left (bleed on the right)
  and at `x = bleed` when it is on the right. Vertical bleed unchanged, both sides.
- `coverWrapGeometry` takes the cover type. Back and front panels sit inside the wrap at the
  cover's own overhang, the spine panel between them, flaps outside them for a dust jacket.

### Export (`src/components/ExportPanel.tsx`)

- Cover type selector (softcover / dust jacket / ImageWrap), persisted with the project.
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

- **Cover type unavailable for a size** (softcover is not offered above a certain format): the
  selector hides it rather than emitting an invalid wrap.
- **Spine override**: still wins over the table, unchanged behaviour.
- **Existing projects**: they keep their size id and pick up the corrected trim, so their pages
  re-fit. Nothing is lost; no photo is cropped.
- **Odd page count**: a blank leaf, never a duplicated page.
