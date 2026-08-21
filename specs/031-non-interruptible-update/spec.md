# Spec 031: Non-interruptible one-click update

## Context

Spec 025 added a one-click server update: "Update now" spawns a detached Docker helper that
recreates the stack, and the client polls until the new version is live, then reloads. The
mechanism works, but the UX is interruptible and fragile:

- The "updating" state lived locally in `UpdatesSheet`. A page refresh threw it away, showed
  "Update available" again, and let the user re-click mid-update.
- A double-click hit the server's `updating` flag and surfaced as a generic
  "Could not start the update on the server.", hiding the real cause.
- The server `updating` flag could get stuck `true` if a recreate never completed, permanently
  refusing further updates.

The user's requirement: **the user must not be able to interrupt an update in progress.**

## Goals

- Once an update starts, lock the whole screen with a state that **survives a page refresh** and
  **cannot be dismissed or re-triggered** while it runs.
- Poll robustly through the container recreation (the API is briefly down) and reload when the
  target version is live.
- Never lock forever: a safety timeout flips the overlay to a recovery state with a manual reload.
- Surface the real server error when an update genuinely fails to start.
- Auto-clear a stuck server-side `updating` flag.

## Non-goals

- No change to the update mechanism itself (helper container, compose recreate).
- No multi-arch image build (tracked separately).
- No progress percentage or live server logs in the UI.

## Requirements

1. A persistent update lock (`{ target, startedAt }`) stored in `localStorage` under `pp.updating`.
2. A full-screen overlay (`UpdatingOverlay`) shown whenever the lock is set. No close control, no
   background click-through. It outranks loading and the auth flow so a refresh mid-update stays
   locked instead of dropping to login.
3. On app init the lock is restored before anything else; if fresh, the overlay owns the screen and
   the normal project load is skipped. A stale lock (older than the timeout) is cleared.
4. The poll hits the server version endpoint **directly** (independent of the active backend), so it
   works even if `initBackend` fell back to local mode during recreation. Reload on `current === target`.
5. Safety timeout (4 minutes): the lock is marked `failed`, the overlay shows "taking longer than
   expected" with Reload and Dismiss.
6. The server distinguishes "already in progress" (`inProgress: true`) from other failures. The
   client locks the UI when the server reports started **or** already-in-progress; it only shows an
   error (with the server's message + manual command) on a genuine failure.
7. The server auto-clears its `updating` flag after 5 minutes so a failed recreate cannot lock out
   future updates.

## Acceptance criteria

- [x] Clicking "Update now" replaces the whole screen with the locked overlay; the update sheet and
      admin menu are no longer reachable.
- [x] Refreshing the page during an update shows the same locked overlay (no re-trigger, no login).
- [x] When the new version comes up, the app reloads to it automatically.
- [x] A second update attempt while one is running is treated as "in progress" and locks, not errors.
- [x] After the safety timeout the overlay offers a manual reload and can be dismissed.
- [x] A genuine start failure shows the server's real error plus the manual command.
- [x] The server `updating` flag clears itself after 5 minutes.

## Edge cases

- API down during recreate: poll returns null, the overlay keeps waiting (no error).
- `initBackend` falls back to local mode mid-recreate: the lock still restores and the direct poll
  still reaches the server once it is back.
- `target` unknown (empty): the poll never matches, so the safety timeout provides the escape.
- Multiple tabs: each tab restores the lock from `localStorage` and polls independently; all reload
  when the version lands.

## Invariant

Not applicable to the layout engine. This spec touches update/session plumbing only; no photo is
resized or cropped.
