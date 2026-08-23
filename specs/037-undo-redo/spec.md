# 037 - Undo and redo

## Context

Nothing in Passepartout can be taken back. Every edit is immediate and persisted a few hundred
milliseconds later: retitle a page, drag a photo off a grid you arranged by hand, delete a
photo from the Library, change the book size. Two of those are destructive and were shipped
this week (issues 66 and 70), and the only recovery is to redo the work by hand.

An album is a long, exploratory edit. Trying a layout, disliking it and pressing Ctrl+Z is the
normal way to work on one.

## Goals

- Ctrl+Z undoes the last album edit, Ctrl+Shift+Z redoes it (Cmd on a Mac).
- Two arrows in the top bar do the same, disabled when there is nothing to take back, so the
  feature is discoverable without knowing the shortcut.
- Everything that changes the ALBUM is covered, including importing photos and deleting one.

## Non-goals

- **Project actions stay outside**: creating, opening, renaming, duplicating, deleting a
  project, and importing a bundle. They are not album edits, they already ask for confirmation
  where it matters, and mixing them in would make Ctrl+Z unpredictable.
- **Not persisted**: the history lives in the session. Reloading the page starts from a clean
  slate, and switching project clears it.
- **No branching history**, no visible timeline. One linear stack, redo lost on the next edit.
- **View state is not history**: zoom, the grid overlay, the Library filter and column count,
  the active language. Undo is about the album, not about how you are looking at it.

## The one rule

Untouched. Undo restores a previous album state; it never reaches the layout engine, and a
restored photo keeps its native ratio exactly as it had it. Nothing is cropped or resized.

## Requirements

### R1 - What a step is

The undoable state is the album DOCUMENT, the same shape `serializeProject` persists: photos
(their metadata, caption, crop, mask, frame, rotation), pages, the four cover faces, the spine,
the book size, the font and color themes and the text sizes.

A step is recorded whenever any of those changes. Everything else the store holds (projects
list, session, version info, update lock, whether storage works) is not part of a step.

### R2 - Typing is one step, not one per letter

Consecutive edits to the same text field are merged while they keep coming: a page title, a
subtitle, a caption, a cover title or subtitle, the spine title, the handwritten frame note.
Same for a slider held down. Moving to another field, or pausing, starts a new step.

### R3 - Depth

The last 50 steps. Beyond that the oldest is dropped.

### R4 - Import and deletion are undoable, which means the bytes must survive

Undoing a deletion must give back a photo that still displays, and redoing an import must not
have to re-read the files. So image bytes are no longer deleted the moment a photo is:

- `deletePhoto` removes the photo from the album but leaves its blob in storage.
- Undoing an import leaves the imported blobs in place, so redo puts the photos back.
- Unreferenced blobs are swept at startup: any image not referenced by any stored project is
  deleted then.

This **changes what issue 66 shipped**: deleting a photo used to drop its bytes immediately.
It now drops them at the next start. The alternative, holding the bytes in memory for the
undo window, would cost tens of megabytes per deleted photo.

### R5 - Keyboard

Ctrl+Z / Cmd+Z undoes, Ctrl+Shift+Z / Cmd+Shift+Z and Ctrl+Y redo. The shortcut works while a
text field has focus: our own history coalesces typing per field (R2), and a controlled React
input has no reliable native undo of its own, so intercepting is better than leaving a dead
shortcut. A shortcut that would do nothing is ignored rather than swallowed.

### R6 - Buttons

A pair of arrows in the top bar, next to the project switcher, each disabled when its stack is
empty, each with a tooltip naming the shortcut. Same visual language as the existing top bar
controls.

## Acceptance criteria

- [x] Ctrl+Z takes back the last album edit; Ctrl+Shift+Z and Ctrl+Y put it back.
- [x] The arrows do the same and are disabled when their stack is empty.
- [x] Typing a title then pressing Ctrl+Z once clears that whole title edit, not one letter.
- [x] Editing title A then title B then undoing twice restores both, in order.
- [x] Undo covers: page title and subtitle, slot count, layout, whitespace, custom placement,
      placing and removing a photo, page add, delete and move, cover text and photo, spine
      title, book size, themes, text sizes, photo caption, crop, mask, frame and rotation.
- [x] Deleting a photo then undoing puts it back in the Library, on the pages and covers that
      held it, and it still displays.
- [x] Importing photos then undoing removes them; redo puts them back without re-reading files.
- [x] A new edit after an undo drops the redo stack.
- [x] Switching project clears both stacks; the history never carries state across projects.
- [x] Undo triggers a save, so what is restored is what is persisted.
- [x] The history holds at most 50 steps.
- [x] Blobs of deleted photos are gone after a restart.
- [x] Zoom, grid overlay, Library filter and language are unaffected by undo.

## Edge cases

| Case | Expected |
| --- | --- |
| Undo with an empty stack | Nothing happens, no error, button disabled |
| Undo right after loading a project | Nothing to undo: loading is not an edit |
| Undo an import while a later import is in flight | The in-flight import lands on top, the album stays coherent |
| Undo a page delete that emptied the album | The page comes back with its photos |
| Deleting a photo, undoing, then deleting again | Works both times; one blob, no duplicate |
| 50 edits then undo 50 times | Back to the state 50 edits ago, the 51st is not available |
| Undo while the Arrange mode is open | The placement reverts under the open editor |
| Shortcut inside a text field | Handled by the app, one field edit at a time |
