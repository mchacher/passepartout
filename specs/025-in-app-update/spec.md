# 025 - In-app update (Sowel-style, opt-in 1-click)

## Context

Step B part 1 (spec 024) added the server. The release pipeline (spec 023) publishes versioned
images to GHCR. This is **part 2 of B**: a running server-mode instance detects a newer version
and can apply it in one click, the way Sowel does.

**Security note (drives the design).** One-click update means the server triggers
`docker compose pull && up -d` on the host, which requires the Docker socket. Mounting
`/var/run/docker.sock` gives the container effective root on the host: an RCE against the app
would escalate to the host. Sowel accepts this as an **opt-in**, documented trade-off (the
socket line is removable; the button disables cleanly without it). We adopt the same model:

- **Detection always works** (no socket needed).
- **One-click apply is opt-in**: it only works when the operator has consciously mounted the
  Docker socket (commented in compose, with the warning). Without it, the UI shows the manual
  command instead of an "Update now" button.

## Goal

In server mode, show the running version and, when a newer release exists, offer to update:
one click when the socket is mounted, a copy-paste command otherwise.

## Non-goals

- No update in local (static) mode - there is no server to orchestrate it.
- No auto-update on a schedule (manual trigger only).
- No rollback UI (a failed pull leaves the old container running; manual recovery documented).
- No change to the layout engine or album data.

## Requirements

1. **Version endpoint** `GET /api/version` (session-gated): returns `{ current, latest,
   updateAvailable, canApply }`.
   - `current`: the running version (the api reads its `package.json`, bumped with the web by
     `scripts/release.sh`).
   - `latest`: the newest GitHub release tag, fetched with an optional `GITHUB_TOKEN` (the repo
     is private). `null` when no token or the check fails - detection degrades, never errors.
   - `updateAvailable`: semver `current < latest` (only when `latest` is known).
   - `canApply`: whether `/var/run/docker.sock` is present (one-click possible). The GitHub
     result is cached (~1h) so the endpoint is cheap.
2. **Update endpoint** `POST /api/update` (session-gated): when the socket is present, spawn a
   detached **helper container** (`docker:cli`) that runs `docker compose pull && up -d` for the
   project (found via the compose labels on the running container), so the update survives the
   api/web containers being recreated. Guard against concurrent updates. When the socket is
   absent, return 409 with the manual command; never half-apply.
3. **In-app UI** (server mode only): the top bar shows an update affordance when
   `updateAvailable`. Opening it shows current -> latest and either an **Update now** button
   (`canApply`) or the `docker compose pull && up -d` command. After "Update now", the app shows
   an "updating, reconnecting..." state and polls `GET /api/version` until it reports the new
   version (the containers have been recreated), then reloads.
4. **Version parity**: `scripts/release.sh` bumps BOTH `package.json` and `server/package.json`
   so the web (`__APP_VERSION__`) and the api (`/api/version.current`) report the same version,
   matching the released image tag.
5. **Packaging**: the `api` service in `docker-compose.yml` mounts the Docker socket **by
   default** (one-click on out of the box, like Sowel), with the security trade-off in the
   compose comment and a note that removing the line disables it. The **UI carries no security
   warning** - the caveat lives in the compose/docs only. Also an optional `GITHUB_TOKEN`. The
   api image adds `dockerode` (to spawn the helper) - it does not need the Docker CLI itself.
6. The engine and album data are untouched.

## Architecture

```
GET /api/version
  current = server package.json version
  latest  = GitHub latest release (with GITHUB_TOKEN; cached ~1h; null if unknown)
  canApply = exists(/var/run/docker.sock)

POST /api/update  (socket required)
  dockerode -> run a detached `docker:cli` helper with the socket + the compose
               project working dir (from com.docker.compose.project.* labels) mounted:
                 sh -c 'sleep 3; docker compose pull && docker compose up -d'
  -> the helper recreates web + api; the app polls /api/version until it flips.

UI (server mode): TopBar shows "vX available" -> UpdatesSheet:
  canApply ? [Update now] -> POST /api/update -> poll -> reload
           : show `docker compose pull && docker compose up -d`
```

- Server: new `server/src/version.ts` (current + GitHub latest, cached) and
  `server/src/updater.ts` (socket check + helper spawn via dockerode), wired into routes.
- Frontend: `remoteBackend` gains `version()` and `applyUpdate()`; a small `UpdatesSheet`
  component + a TopBar affordance (shown only in remote mode when an update is available).
- This mirrors Sowel's `update-manager` (helper container, compose labels, survive-recreate),
  scaled down (no rollback/backup orchestration).

## Acceptance criteria

- [x] `GET /api/version` returns the running version; `latest`/`updateAvailable` populate when a
      `GITHUB_TOKEN` is set, and degrade to `null`/`false` without one (no error).
- [x] `canApply` reflects whether the Docker socket is mounted.
- [x] With the socket mounted, `POST /api/update` starts a detached helper that pulls and
      recreates the stack; the app polls and reloads on the new version. (Verified on the host
      by the maintainer; the endpoint/spawn logic is unit-tested and socket-gated here.)
- [x] Without the socket, `POST /api/update` returns 409 + the manual command, and the UI shows
      the command instead of a button. Detection still works.
- [x] The update affordance appears only in server mode when an update is available; local mode
      is unaffected.
- [x] `scripts/release.sh` bumps both package.json files; web and api report the same version.
- [x] `npm run validate` stays green; server typecheck + tests stay green.

## Edge cases

- **No token (private repo)**: `latest` is `null`; the UI just shows the current version, no
  false "up to date". Documented.
- **Socket absent**: one-click disabled, manual command shown; no partial update.
- **Concurrent updates**: a second `POST /api/update` while one runs returns 409 (in progress).
- **Update kills the api mid-request**: the helper is detached and started before the response,
  so recreation does not abort it; the client polls `/api/version` (tolerating connection drops)
  until it reports the new version.
- **Pull fails / CDN lag**: the old containers keep running (compose only recreates on a new
  image); the helper logs the failure; the version does not flip, and the UI times out with a
  "try again / update manually" message.
- **GHCR is private**: the host must `docker login ghcr.io` for the pull to succeed; documented
  next to the socket opt-in.
