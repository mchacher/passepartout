# Spec 038: Click a photo to arrange (retire the "Disposer" toggle)

Issue: #84

## Context

Free placement is entered through a toggle in the page toolbar (`PageCard.tsx:119-135`). It
flips a local `editing` state, which swaps the whole page toolbar and switches `Paper` from
display `Cell`s to `EditCell`s. The toggle only renders when the page is arrangeable:

```
canArrange = placed >= 1 && placed === slots && !isFullPage      // PageCard.tsx:35
```

The mode itself is good; reaching it is not. The user wants to touch the photo, not a mode
switch. Today, clicking a photo on a page does nothing at all, so the gesture is free.

## The one rule

Untouched. This spec changes how a mode is entered and left. No geometry, no engine, no
ratio, no clipping.

## Goals

1. **Click to enter.** Clicking a photo on an arrangeable page enters layout editing for that
   page, with the clicked photo as the primary selection.
2. **Retire the toggle.** The "Disposer" button disappears from the page toolbar.
3. **Obvious exits.** Escape, a click outside the page, and a "Done" control in the editing
   toolbar all leave the mode.
4. **One page at a time.** Entering editing on a page leaves any other page's editing mode.
5. **Nothing else is swallowed.** Remove, caption, and the drag that swaps two slots keep
   working exactly as they do today.

## Non-goals

- No change to what editing can do (move, resize, pan, restack, multi selection).
- No entry into editing from an empty slot: empty slots stay drop targets, and a page with an
  empty slot is not arrangeable anyway (spec 035).
- No editing on a full page photo (spec 012), unchanged.
- The selected photo outline is issue #85, a separate change.

## Behaviour

| Gesture | Page arrangeable | Page not arrangeable |
| --- | --- | --- |
| Click a photo | enters editing, that photo primary | nothing happens |
| Click the remove button | removes the photo | removes the photo |
| Click the caption | edits the caption | edits the caption |
| Drag a photo to another slot | swaps the two slots | swaps the two slots |
| Escape while editing | leaves editing | n/a |
| Click outside the page while editing | leaves editing | n/a |
| Click "Done" | leaves editing | n/a |

A drag is never read as a click: a click handler fires only when no drag started, which is
already how the browser sequences `dragstart` and `click`.

## State

Editing moves from a `useState` inside each `PageCard` to the view store, as a single
`editingPageId: string | null` plus the slot index to select on entry:

```ts
// viewStore
arrange: { pageId: string; index: number } | null
startArrange(pageId, index)   // replaces any other page being arranged
stopArrange()
```

`PageCard` reads `arrange?.pageId === page.id && canArrange` for its `editing` prop, and
passes `arrange.index` to `Paper` as the initial selection. `Paper` seeds the selection with
that index instead of the hard coded `selectSingle(0)` (`Paper.tsx:114`).

Ephemeral, like the rest of the view store: not persisted, not part of the project document,
not undoable. Opening another project clears it, so no stale page id survives a switch.

## Acceptance criteria

- [x] Clicking a photo on an arrangeable page enters editing with that photo primary and the
      editing toolbar shown.
- [x] The "Disposer" button no longer exists; `page.arrange`, `page.arrangeStart` and
      `page.arrangeDone` are retired from `i18n.ts` (EN and FR); `page.done` stays for the
      Done control.
- [x] Escape leaves editing. With the crop editor open, Escape closes the crop editor first
      and a second Escape leaves editing.
- [x] A click outside the page card leaves editing.
- [x] Clicking a photo on a page with an empty slot, or on a full page photo, does nothing.
- [x] Clicking the remove button or the caption does not enter editing.
- [x] While not editing, dragging a photo onto another slot still swaps them.
- [x] Entering editing on a second page leaves the first one.
- [x] The edited placement is kept on exit, as today.
- [x] Switching project leaves no page in editing.
- [x] Verified by driving the real app (no component tests exist).
