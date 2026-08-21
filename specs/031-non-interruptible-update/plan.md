# Plan 031: Non-interruptible one-click update

## Implementation steps

1. **Server** (`server/src/updater.ts`): track `updateStartedAt`; `isUpdating()` auto-clears the
   flag after `STALE_MS` (5 min); `startUpdate` returns `inProgress: true` when already running. [x]
2. **Server** (`server/src/app.ts`): `/update` includes `inProgress` in the 409 body. [x]
3. **Persistence** (`src/persistence.ts`): `applyUpdate` returns `{ started, inProgress?, error?,
   manualCommand? }`; add `pingServerVersion()` fetching `/api/version` regardless of backend. [x]
4. **Store** (`src/store.ts`): `UpdateLock` type + localStorage helpers; `updating` state;
   `beginUpdate()` (locks on started/in-progress, persists, starts the poll); `dismissUpdate()`;
   `runUpdatePoll()` (direct version poll, reload on target, timeout -> failed); restore the lock in
   `initProjects` before the normal load. [x]
5. **UI** (`src/components/UpdatingOverlay.tsx`): full-screen locked overlay + recovery state. [x]
6. **UI** (`src/App.tsx`): early return `<UpdatingOverlay />` when `updating`, above loading/auth. [x]
7. **UI** (`src/components/UpdatesSheet.tsx`): "Update now" delegates to `beginUpdate`; show the real
   error on failure; drop the local updating phase/poll. [x]

## Test Plan

| Module   | Scenario                                             | Expected                                             |
| -------- | ---------------------------------------------------- | ---------------------------------------------------- |
| updater  | `isUpdating` after `STALE_MS` with flag set          | returns false (auto-cleared)                         |
| updater  | `startUpdate` while already updating                 | `{ started: false, inProgress: true }`               |
| app      | `POST /update` while in progress                     | 409 with `inProgress: true` + `manualCommand`        |
| store    | `beginUpdate` when server started                    | `updating` set, `pp.updating` persisted, `locked`    |
| store    | `beginUpdate` when server reports in-progress        | locks (does not error)                               |
| store    | `beginUpdate` on genuine failure                     | `{ locked: false, error }`, no lock set              |
| store    | init with a fresh persisted lock                     | `updating` restored, normal load skipped             |
| store    | init with a stale persisted lock                     | lock cleared, normal load proceeds                   |
| store    | `dismissUpdate`                                      | `updating` null, `pp.updating` removed               |

Server units live in `server/test`; store units in `src/*.test.ts`. UI overlay is verified in-app
(no component tests in this project), per the workflow.
