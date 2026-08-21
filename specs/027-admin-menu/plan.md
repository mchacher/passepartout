# 027 - Admin menu + check for updates - plan

## Server

1. `server/src/version.ts`: `fetchLatest(token?, opts?: { force?: boolean })` - when `force`,
   skip the cache read (still updates the cache). `GET /api/version` reads `?refresh=1` and
   passes `{ force: true }`.
2. Test: `fetchLatest` with `force` re-hits fetch even inside the cache window.

## Frontend

3. `src/persistence.ts`: `PersistenceBackend.version(force?: boolean)`; remote appends
   `?refresh=1` when force; local unchanged.
4. `src/store.ts`: `refreshVersion(force?)` passes it through; add a `versionChecking` flag set
   around a forced check (for the button's disabled state).
5. `src/components/AdminMenu.tsx` (new, server mode only): a top-bar button (user/gear icon) ->
   dropdown with the signed-in user, **Users** (opens `UsersPanel`), the version + **Check for
   updates** (calls `refreshVersion(true)`, shows "Up to date" / "vX available" -> `UpdatesSheet`),
   and **Log out**. Owns the `UsersPanel` + can open the `UpdatesSheet`.
6. `src/components/ProjectMenu.tsx`: remove the user line / Users / Log out; keep the version
   footer only when `!remote`.
7. `src/components/TopBar.tsx`: render `<AdminMenu>` (remote only); keep the Update badge.

## Test Plan

| Module | Scenario | Expected |
| ------ | -------- | -------- |
| version | `fetchLatest(t, {force:true})` inside the cache window | re-fetches (not the cached value) |
| /api/version?refresh=1 | authed | re-queries; returns fresh shape |
| remote adapter | `version(true)` | requests `/api/version?refresh=1` |

Engine invariant: N/A (UI + transport). 256 frontend + server suites stay green.

## Verification (Phase 5)

- Server mode: the project menu has only project actions; an Admin menu shows user / Users /
  version / Check for updates / Log out. Click Check for updates -> a result appears. Users
  panel still works from the Admin menu. The Update badge/sheet still work (simulate via a
  patched `/api/version`). Local build: no Admin menu, version still in the project menu.
