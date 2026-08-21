# 027 - Admin menu (split from projects) + check for updates

## Context

The project menu (top-left) has grown to hold both **project** actions (new / open / rename /
duplicate / delete, import / export) and **instance administration** (the signed-in user, user
management, app version, log out). That mixes two concerns. Also, the update check only runs
once at load and the server caches GitHub for ~1h, so there is no way to ask "is a new version
out?" on demand.

## Goal

Split the two concerns: keep the project menu for **projects only**, and add an **Admin menu**
for the instance (server mode). Add a **Check for updates** action that bypasses the cache.

## Non-goals

- No new roles/permissions (all users still equal - spec 026).
- No change to what the features do (this is a UI reorganization + a cache-bypass).
- Local (static) mode keeps no admin surface (no accounts, no server updates).

## Requirements

1. **Project menu = projects only**: new / open / rename / duplicate / delete, and Import /
   Export bundle. Remove the user line, Users, Log out and the version from it. (The tiny app
   version stays in the project menu **only in local mode**, where there is no admin menu.)
2. **Admin menu** (a new top-bar menu, **server mode only**): the signed-in user, **Users**
   (the existing panel), the app **version**, **Check for updates** (+ the update affordance),
   and **Log out**. An avatar/gear button on the right of the top bar opens it.
3. **Check for updates**: `GET /api/version?refresh=1` bypasses the server's ~1h GitHub cache
   and re-fetches the latest release. The Admin menu's button calls it and shows a clear result:
   "Up to date" or "vX available" (opening the update sheet).
4. **Update affordance**: the existing top-bar "Update" badge (shown when an update is
   available) stays as an at-a-glance signal and opens the update sheet; the Admin menu also
   surfaces it. No duplication of the sheet itself.
5. The engine and album data are untouched; local mode is unchanged apart from where the
   version label sits.

## Architecture

```
Top bar (server mode):  [ Project menu | ... | Update badge? | Admin menu ]

Project menu  -> projects only (new/open/rename/duplicate/delete, import/export)
Admin menu    -> signed-in user
                 Users            (UsersPanel)
                 vX.Y.Z  [Check for updates]  -> up to date | vY available -> UpdatesSheet
                 Log out

Server: GET /api/version?refresh=1 -> fetchLatest(token, { force: true }) (skip the cache).
Store:  refreshVersion(force?) -> backend.version(force) ; a `versionChecking` flag for the button.
```

- New `src/components/AdminMenu.tsx`; `ProjectMenu.tsx` trimmed to projects (+ version in local
  mode only). `TopBar` renders the Admin menu (remote only).
- Server: `version.ts` `fetchLatest(token, opts?: { force?: boolean })`; `GET /api/version`
  reads `?refresh=1`. Frontend `PersistenceBackend.version(force?)`, store `refreshVersion(force?)`.

## Acceptance criteria

- [x] The project menu shows only project actions (no user / Users / Log out / version) in
      server mode; the version stays in it only in local mode.
- [x] In server mode an Admin menu opens from the top bar with the signed-in user, Users, the
      version, Check for updates, and Log out.
- [x] **Check for updates** re-queries GitHub even within the cache window (via `?refresh=1`) and
      shows "Up to date" or surfaces the available version.
- [x] The update badge + update sheet still work; no feature is lost, only relocated.
- [x] Local mode is unchanged (no admin menu; version still shown in the project menu).
- [x] `npm run validate` + server tests stay green (a version-force test added).

## Edge cases

- **Local mode**: no Admin menu at all; the project menu keeps the small version label.
- **No token**: Check for updates still runs but `latest` stays null -> the button reports
  "Update check unavailable (no GitHub token)". Documented behavior, not an error.
- **Rapid clicks**: the check is guarded by a `versionChecking` flag so the button disables
  while in flight.
- **Cache**: `?refresh=1` forces a re-fetch and refreshes the cached value for later reads.
