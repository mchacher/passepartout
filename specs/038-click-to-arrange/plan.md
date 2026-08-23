# Plan 038: Click a photo to arrange

Branch: `feat/issue-84-click-to-arrange`. Rebase on master after the undo and redo work
(spec 037) merges: it edits `i18n.ts`, `store.ts`, `App.tsx` and `TopBar.tsx`.

## 1. Pure lib (tests first)

`src/lib/arrange.ts`, new, pure, unit tested in `src/lib/arrange.test.ts`:

- `canArrange(placed: number, slots: number, isFullPage: boolean): boolean`
  Lifted verbatim from `PageCard.tsx:35`, so the rule lives in one tested place.
  Cases: full page false, `placed === 0` false, `placed < slots` false, `placed === slots`
  true, full page mode false even when full.

## 2. View store

`src/viewStore.ts` gains `arrange`, `startArrange`, `stopArrange` (see the spec). Tests in
the existing `src/viewStore.test.ts`:

- `startArrange` sets page and index.
- `startArrange` on another page replaces the first one (never two at once).
- `stopArrange` clears it.

## 3. Paper

- `PaperProps` gains `initialIndex?: number`; the seeding effect (`Paper.tsx:114`) uses
  `selectSingle(initialIndex ?? 0)`, clamped to the cell count.
- Display `Cell` gains an `onActivate?: () => void`, wired as `onClick` on the draggable
  photo wrapper only (`Paper.tsx:517-529`), never on the caption or the remove button.
- `Paper` calls `onActivate` for cell `idx` only when it is NOT already editing.

## 4. PageCard

- Delete the toggle button (`PageCard.tsx:119-135`) and the local `editing` state.
- `editing = arrange?.pageId === page.id && canArrange(...)`.
- Pass `initialIndex={arrange?.index}` and `onActivate={(i) => canArrange(...) && startArrange(page.id, i)}`.
- Keep a "Done" button at the head of the editing toolbar, calling `stopArrange()`, reusing
  `page.done`.

## 5. Exits

- Escape: a `useEffect` in `PageCard` while editing, or a small `useArrangeEscape` hook next
  to `useUndoShortcuts.ts`. It must not fire while the crop editor is open (`cropping !== null`)
  so the crop editor keeps the first Escape.
- Click outside: a `pointerdown` listener while editing that calls `stopArrange()` when the
  event target is outside the page card element. Guard against the click that opened the mode
  (listen from the next tick, or compare against the card ref).

## 6. i18n

Remove `page.arrange`, `page.arrangeStart`, `page.arrangeDone` (EN `i18n.ts:480` area and FR
`i18n.ts` mirror). Keep `page.arrangeHint` and `page.selectHint`, reworded if they mention the
button. `i18n.test.ts` already checks key parity between EN and FR.

## 7. Validate and verify

- `npm run validate` (tsc, eslint, vitest).
- `npm run build && npm run preview`: import photos, fill a page, click a photo, check the
  primary selection is the clicked one, move and resize, press Escape, click outside, click a
  photo on a half filled page (nothing), drag a photo onto another slot while not editing
  (swap works), open the crop editor and press Escape twice. Screenshot light and dark.

## Test Plan

The engine is untouched, so there is no ratio or fit assertion to add: no code path here
changes a cell's geometry, only which page is in editing and which cell is primary.

| Module    | Scenario                                              | Expected                                        |
| --------- | ----------------------------------------------------- | ----------------------------------------------- |
| arrange   | page full, not full page mode                          | `canArrange` true                               |
| arrange   | a slot is still empty (`placed < slots`)               | `canArrange` false                              |
| arrange   | no photo placed                                        | `canArrange` false                              |
| arrange   | full page mode (spec 012), even when full              | `canArrange` false                              |
| viewStore | `startArrange(pageA, 2)`                               | `arrange` = `{ pageId: pageA, index: 2 }`       |
| viewStore | `startArrange(pageB, 0)` while page A is arranged      | page B replaces page A, never two at once       |
| viewStore | `stopArrange()`                                        | `arrange` is null                               |
| viewStore | `startArrange` never writes to localStorage            | transient, no stale page id after a reload      |

Clearing `arrange` when another project opens lives in an `App` effect, which has no test
harness here (no component tests); it is verified by driving the app.

Verified by driving the app (no component tests exist): click to enter with the clicked photo
primary, Escape and outside-click to leave, a click doing nothing on a page that cannot be
arranged, the remove button and the caption not entering editing, and a slot swap by drag
still working while not editing.
