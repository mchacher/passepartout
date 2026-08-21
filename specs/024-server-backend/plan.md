# 024 - Server-backed data (step B, part 1) - implementation plan

Split into four commits so each is reviewable and independently green.

## Commit 1 - the backend (`server/`)

- `server/package.json` (or a workspace) with Fastify, `@fastify/cookie`, `better-sqlite3`,
  `bcryptjs`, `pino`; TS build to `server/dist`.
- `server/src/db.ts` - open `/data/app.db`, migrate a `projects(id TEXT PK, doc TEXT,
  createdAt INT, updatedAt INT)` table; blob dir `/data/blobs`.
- `server/src/auth.ts` - hash the env password once; `login` verifies + sets a signed cookie;
  a `preHandler` guards `/api/*` (allow `health`, `login`).
- `server/src/routes.ts` - projects CRUD (doc JSON) + images (stream to/from `/data/blobs`) +
  `health`.
- `server/src/index.ts` - build the Fastify app, serve on `:3000`.
- `server/src/*.test.ts` - Fastify `inject` tests: 401 without auth; login ok/ko; project
  create/get/list/update/delete; image put/get round-trip; on a temp dir + in-memory/temp db.

## Commit 2 - the frontend persistence backend

- Refactor `src/persistence.ts` into a `PersistenceBackend` interface + `localBackend`
  (the current IndexedDB code, unchanged) + `remoteBackend` (fetch `/api`).
- `remoteBackend`: `listProjects`/`loadProjectDoc`/`saveProjectDoc`/`create`/`deleteProject`
  via `/api/projects`; `putImage` -> `PUT /api/images/:id`; image URL provider returns
  `/api/images/:id` (no blob fetch). `copyImage` -> a server copy endpoint or client re-put.
- **Mode detection**: an async `initBackend()` probes `GET /api/health`; picks remote or local;
  the store's `initProjects` awaits it. Expose `isRemote` + `logout()`.
- Thread `urlFor` from the backend into the store's `openProject` (object URL for local,
  `/api/images/:id` for remote); `hydratePhotos` unchanged.
- `remoteBackend` unit tests with a mocked `fetch`.

## Commit 3 - the login screen

- `src/components/Login.tsx` - a single-password form; on submit `POST /api/auth/login`.
- In remote mode, gate the app: if `GET /api/auth/me` is 401, render `Login`; else the app.
- A **Log out** action in `ProjectMenu` (remote mode only) -> `logout()` + back to `Login`.

## Commit 4 - packaging + docs

- `server/Dockerfile` (build + run the api).
- `docker-compose.yml`: uncomment/add the `api` service (build, `/data` named volume, env
  `PASSEPARTOUT_PASSWORD` + `SESSION_SECRET`); keep `web`.
- `docker/nginx.conf`: uncomment the `/api` proxy to `http://api:3000/`.
- `.github/workflows/release.yml`: a second build/push for the `api` image.
- `docs/self-hosting.md`: a "Server mode (data on the server)" section - env, volume, login.

## Test Plan

| Module | Scenario | Expected |
| ------ | -------- | -------- |
| server/auth | request `/api/projects` with no cookie | 401 |
| server/auth | login wrong password | 401; login right password | 200 + cookie |
| server/projects | create -> get -> list -> update -> delete | doc round-trips; list reflects each step |
| server/images | put bytes then get | same bytes, correct content-type, cache-immutable |
| remote adapter | saveProjectDoc / loadProjectDoc (mocked fetch) | correct method/URL/body; parses the doc |
| remote adapter | image url provider | returns `/api/images/:id` (no fetch) |
| mode detection | health 200 -> remote; health fails -> local | backend selected accordingly |

Engine invariant: N/A - no engine/ratio code is touched (this is storage + transport). Noted
per the workflow. The existing 249 tests must stay green.

## Verification (Phase 5)

- `docker compose up -d` (web + api): open the instance -> login prompt -> after login, create
  a project, import photos / a bundle, edit, refresh -> everything persists server-side.
- A second browser (empty IndexedDB) logging in sees the same albums (proves server storage).
- Recreate the `api` container -> data still there (named volume).
- Build the static-only image (no api) -> the app stays in local mode, unchanged.
- Wrong password rejected; `curl /api/projects` without a cookie -> 401.
