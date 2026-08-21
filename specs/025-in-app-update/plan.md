# 025 - In-app update - implementation plan

Two phases: A (detection, safe, fully verifiable) then B (opt-in one-click apply).

## Phase A - version detection

1. **`server/src/version.ts`**: `readCurrentVersion()` (server package.json);
   `fetchLatest(token?)` -> latest GitHub release tag for `mchacher/passepartout` (via the
   GitHub API, `Authorization: token` when provided), cached ~1h; `isNewer(current, latest)`
   semver compare. All failures -> `null` (never throw).
2. **`server/src/app.ts`**: `GET /api/version` (gated) -> `{ current, latest, updateAvailable,
   canApply }` where `canApply = existsSync('/var/run/docker.sock')`.
3. **`server/src/*.test.ts`**: version compare (newer / equal / older / missing), endpoint shape
   with `fetch` mocked (token present vs absent).
4. **Frontend**: `remoteBackend.version()` -> the endpoint; local backend returns
   `{ current: __APP_VERSION__, latest: null, updateAvailable: false, canApply: false }`.
5. **`UpdatesSheet` + TopBar affordance** (remote mode only): a small button/badge shown when
   `updateAvailable`; the sheet shows current -> latest and the manual command.

## Phase B - opt-in one-click apply

6. **`server/src/updater.ts`**: `isDockerAvailable()`; `startUpdate()` - via `dockerode`, read
   this container's compose labels (`com.docker.compose.project`, `...working_dir`), then run a
   detached `docker:cli` helper with the socket + working dir mounted, command
   `sh -c 'sleep 3; docker compose pull && docker compose up -d'`. A module flag prevents
   concurrent runs. Pure command/label logic exported for unit tests.
7. **`server/src/app.ts`**: `POST /api/update` (gated) -> 409 + manual command if no socket or
   already running; else start the helper, 202 `{ started: true }`.
8. **Frontend**: `remoteBackend.applyUpdate()`; the sheet's **Update now** (only when
   `canApply`) -> POST, then poll `version()` until `current === latest`, then `location.reload()`.
9. **Packaging**: `server` image adds `dockerode`; `docker-compose.yml` documents the opt-in
   `/var/run/docker.sock` mount (with the security warning) + optional `GITHUB_TOKEN`;
   `release.yml` already builds the server image (no change needed for B).
10. **`scripts/release.sh`**: also `npm version` in `server/` so both package.json files bump.
11. **Docs**: `docs/self-hosting.md` - the update section (detection, the opt-in socket + its
    risk, one-click vs manual, `docker login ghcr.io`).

## Test Plan

| Module | Scenario | Expected |
| ------ | -------- | -------- |
| version | isNewer(1.0.0, 1.0.1) / (1.1.0,1.0.9) / equal / null | true / false / false / false |
| version | fetchLatest with mocked GitHub (token) | returns the tag; without token -> null |
| /api/version | gated; shape with mocked fetch | 401 unauthed; `{current, latest, updateAvailable, canApply}` authed |
| updater | build helper command + read labels (pure) | correct compose command; missing labels -> throws/handled |
| /api/update | no socket | 409 + `{ manualCommand }` |
| /api/update | concurrent | second call 409 (in progress) |
| remote adapter | version()/applyUpdate() (mocked fetch) | correct endpoints/methods |

Engine invariant: N/A (update plumbing). The existing frontend + server suites stay green.

## Verification (Phase 5)

- **A**: with the api running (no token), `GET /api/version` returns the current version,
  `latest: null`, `canApply: false` (no socket in the test compose); the UI shows the version,
  no false update. With a stub `GITHUB_TOKEN` + mocked latest (unit), detection populates.
- **B (host-coupled, cautious)**: unit-test the helper command + label reading and the
  socket-gating (409 without socket). The real pull+recreate is verified by the maintainer on a
  host that has opted into the socket mount and `docker login ghcr.io` - not run from here, to
  avoid recreating the user's stack.
