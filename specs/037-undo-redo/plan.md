# 037 - Implementation plan

## Approach

The store already funnels every album mutation through a single `set`. Rather than touch 35
call sites, `set` is wrapped once inside the store creator: the wrapper compares the DOCUMENT
slice before and after (eleven references: photos, pages, the four covers, spine, bookSize,
fontTheme, colorTheme, textSizes) and records the previous document when any of them changed.

That keeps the recording in one place, cannot be forgotten by a future action, and ignores
non-album state for free. Only the text actions add one line each, to say what they coalesce
with.

## Steps

1. **Pure lib** - `src/lib/history.ts`
   - `pushHistory(stack, entry, { limit, coalesceKey })`: bounded stack with coalescing, pure.
   - `HistoryEntry` holds the document snapshot plus its coalesce key.
   - No React, no store import.

2. **Lib tests** - `src/lib/history.test.ts` (see Test Plan).

3. **Store** - `src/store.ts`
   - `documentOf(state)`: the eleven references as one object; `sameDocument(a, b)` compares
     them by reference.
   - Wrap `set` in the store creator: on a document change, push the previous document, clear
     redo, unless a guard is on (applying an undo, or loading a project).
   - `undo()` / `redo()`: swap the top of one stack onto the other, apply the snapshot, save.
   - `coalesceAs(key)`: set the key the next recorded step merges with. Used by the text
     actions and the whitespace slider.
   - Clear both stacks when a project is opened, created, deleted, duplicated or imported.
   - `deletePhoto` no longer deletes the blob or revokes the object URL (R4).
   - Startup sweep: delete every stored image not referenced by any project document.

4. **Persistence** - `src/persistence.ts`: `listImageIds()` so the sweep can find orphans, on
   the local adapter and the backend interface (the remote one lists via the API or answers
   an empty list, in which case the sweep is skipped rather than guessed at).

5. **Components**
   - `src/components/UndoButtons.tsx`: the two arrows, disabled states, tooltips with the
     shortcut. Semantic tokens only.
   - `src/components/TopBar.tsx`: mount them next to the project switcher.
   - `src/useUndoShortcuts.ts`: the keyboard hook, mounted once in `App.tsx`.
   - `src/lib/i18n.ts`: the new strings, EN and FR.

## Test Plan

| Module | Scenario | Expected |
| --- | --- | --- |
| history | push onto an empty stack | one entry |
| history | push beyond the limit | oldest dropped, newest kept, length capped |
| history | two pushes with the same coalesce key | merged, the OLDEST snapshot kept (that is what undo must restore) |
| history | same key after a different key | not merged |
| history | push with no key | never merges |
| history | limit of 1, then two pushes | only the newest survives |
| store | edit a page title, undo | title restored, page otherwise identical |
| store | typing coalesced: three setPageTitle in a row, undo once | the whole title edit is taken back |
| store | edit two different pages, undo twice | both restored, in reverse order |
| store | undo then redo | back to the edited state |
| store | undo then a NEW edit | redo stack empty |
| store | non-document change (versionInfo, ready) | records nothing |
| store | loading a project | records nothing, stacks cleared |
| store | deletePhoto then undo | photo back in photos, pages and covers |
| store | one continuous drag (40 writes to the same target) | one step, not forty |
| store | an edit that changes nothing (re-clicking the active value) | records nothing |
| history | a pause longer than the window, same field | a new step, not a merge |
| store | deletePhoto | the blob is NOT deleted (R4) |
| store | placement, page add, delete, move, cover, spine, themes, text sizes | each undoable |
| store | 51 edits then undo 50 times | the oldest state is unreachable, no crash |
| store | undo with an empty stack | no-op, state identical by reference |
| store | undo triggers a save | the persisted doc matches the restored state |
| persistence | listImageIds | returns exactly the stored keys |
| store | startup sweep | an orphan blob is deleted, a referenced one is kept |

Import and redo of an import are NOT unit tested: `importFiles` decodes through `Image`, which
node has no equivalent for, so the store has never had a test for it. That path is covered by
driving the built app in Phase 5 instead, and the plan says so rather than pretending.

No engine change: `computeLayout` is not imported, not modified, and its tests are untouched.
Ratio and fit assertions stay where they are; a restored document feeds the same engine with
the same numbers it had before the edit.

## Verification (Phase 5)

- Drive the editor: retitle a page, undo with the keyboard and with the button.
- Delete a photo, undo, check it is back on its page AND still displays (the blob survived).
- Import, undo, redo.
- Type a title fast, undo once, check the whole edit goes, not one letter.
- Check the buttons are disabled at the right times, in light and dark.
