# 024 - Server-backed data (step B, part 1)

## Context

Today Passepartout is local-first: every album lives in the browser's IndexedDB
(`src/persistence.ts`), one dataset per browser. Step A (spec 022) hosts the static app but
not the data. Step B puts the data on the server so any browser hitting the instance sees the
same albums, and sets up the backend that a later in-app "update available" UX needs.

Decisions (taken with the user, 2026-08-21):

- **Pure server** (not local-first + sync): the app talks to an API; no IndexedDB, no offline,
  no conflict resolution. Simplest correct model for "data on the server".
- **Single shared password**: one household instance protected by one password. No per-user
  accounts (that can come later).

This spec is **part 1 of B**: the server, the API, auth, and the persistence swap. **Part 2**
(a later spec) is the in-app "update available -> apply" UX, which builds on this backend and
the release pipeline (spec 023).

## Goal

A backend service so a self-hosted instance stores projects and photos server-side, behind a
single password, with the frontend transparently using it instead of IndexedDB. The static,
local-first mode (spec 022) still works when no backend is present.

## Non-goals

- **No multi-user / accounts** (single password).
- **No offline / local-first sync** (pure server; the API must be reachable).
- **No in-app update UX** (part 2).
- **No photo backup-from-phones, faces, search, timeline** (that is the separate Immich-
  integration vision, not this).
- No change to the layout engine, the album data model, or the no-crop invariant.

## Requirements

1. A **backend** (`server/`, Fastify + better-sqlite3, TypeScript) exposing a REST API under
   `/api`:
   - `GET  /api/health` -> 200 (used by the frontend to detect server mode; unauthenticated).
   - `POST /api/auth/login` {password} -> sets a signed httpOnly session cookie; `POST /api/auth/logout`; `GET /api/auth/me` -> 200 when authenticated. (unauthenticated: health, login.)
   - `GET  /api/projects` -> `ProjectMeta[]`; `GET /api/projects/:id` -> `ProjectDoc`;
     `POST /api/projects` (create) ; `PUT /api/projects/:id` (save doc) ; `DELETE /api/projects/:id`.
   - `GET  /api/images/:id` -> image bytes (long-cache, immutable); `PUT /api/images/:id` -> store bytes.
   - Every `/api/*` except `health` and `login` requires the session (401 otherwise).
2. **Storage**: SQLite (`/data/app.db`) holds the `ProjectDoc`s (JSON) and metadata; image
   blobs live on a filesystem volume (`/data/blobs/<photoId>`). This mirrors the bundle model
   (spec 021), so import/export stay compatible.
3. **Auth**: the password is read from an env var (a bcrypt hash, `PASSEPARTOUT_PASSWORD_HASH`,
   or a plain `PASSEPARTOUT_PASSWORD` hashed on boot). The session cookie is signed with a
   server secret (`SESSION_SECRET`). Passwords are never logged.
4. **Frontend persistence swap**: `src/persistence.ts` becomes a small **backend interface**
   with two implementations selected at runtime:
   - `local` - the existing IndexedDB adapter (unchanged behavior when no server).
   - `remote` - talks to `/api`. On startup the app probes `GET /api/health`; reachable ->
     remote mode, else -> local mode. In remote mode, photos are served directly from
     `/api/images/:id` (no blob download to build object URLs), and a project save `PUT`s the
     doc.
   The store, engine and UI do not change beyond consuming this interface.
5. **Login screen**: in remote mode, when `GET /api/auth/me` is 401, show a single-password
   login before the app; logout available from the project menu.
6. **Import stays**: a `.passepartout.zip` bundle (spec 021) can be imported on the server (it
   writes projects and images through the remote adapter), so existing browser albums move up.
7. **Packaging**: `docker-compose.yml` gains the `api` service (its own image, a `/data`
   volume, the password + secret env); `docker/nginx.conf` proxies `/api` to it. The release
   pipeline (spec 023) also builds and publishes the `api` image.

## Architecture

```
Browser (SPA)
  probe GET /api/health
    reachable -> REMOTE mode: login (single password) -> all persistence via /api
    absent    -> LOCAL mode: IndexedDB, as today (spec 022 static build)

nginx  /            -> static app (dist)
       /api/*       -> api service

api (Fastify)
  auth: signed httpOnly cookie; single password (env, bcrypt)
  SQLite /data/app.db : projects(id, doc JSON, createdAt, updatedAt)
  files  /data/blobs/<photoId> : original image bytes
```

- **Persistence interface** (`src/persistence.ts` -> an interface + `local`/`remote` impls):
  keeps the current async methods (`listProjects`, `loadProjectDoc`, `saveProjectDoc`,
  `putImage`, `getImage`, `deleteProject`, `copyImage`) plus a URL provider so remote can hand
  the store direct `/api/images/:id` URLs while local keeps object URLs. `getLastActiveId` /
  `setLastActiveId` stay in `localStorage` (a harmless per-browser pointer).
- **Store**: `openProject` gets its `urlFor` from the active backend (object URL for local,
  `/api/images/:id` for remote), so `hydratePhotos` is unchanged; `revokeUrls` already only
  revokes `blob:` URLs, so remote URLs are left alone.
- **Reuse in part 2**: the same `api` service gets a version-check/update endpoint and the
  release-pipeline tags drive an in-app UpdatesSheet.

## Acceptance criteria

- [ ] With the `api` service running, the app enters remote mode, asks for the password, and
      after login stores/loads projects and photos on the server (survives a browser with an
      empty IndexedDB, and a different browser sees the same albums).
- [ ] With no backend (the static build), the app stays in local mode exactly as today.
- [ ] Wrong password is rejected; unauthenticated `/api` calls (except health/login) return 401.
- [ ] Photos load via `/api/images/:id` (no full blob download on open); a project edit is
      persisted via `PUT /api/projects/:id`.
- [ ] Importing a `.passepartout.zip` on the server creates the project and its images
      server-side.
- [ ] `docker compose up -d` runs both `web` and `api`; the `/api` proxy works; the SQLite +
      blobs persist across a container recreate (named volume).
- [ ] Server has tests (auth gate, project CRUD, image round-trip); `npm run validate` stays
      green; the engine and no-crop invariant are untouched.

## Edge cases

- **Backend down mid-session**: API calls fail; the app surfaces a clear error and does not
  silently drop edits (pure server has no local cache to fall back to - documented trade-off of
  the chosen model).
- **Large photos**: images are streamed to/from disk, not held in SQLite; `GET /api/images/:id`
  is cache-immutable (ids are content-independent UUIDs but never reused).
- **Auth secret / password rotation**: changing `SESSION_SECRET` invalidates sessions (re-login);
  changing the password env + restart requires re-login. No password is ever logged.
- **Mixed origins**: the SPA and API share one origin via the nginx proxy, so cookies are
  first-party; no CORS needed.
- **Migration from local**: existing browser albums are moved up with the bundle export/import
  (spec 021), not an automatic push (keeps this step simple and explicit).
- **Concurrent edits**: last write wins on `PUT /api/projects/:id` (single household, pure
  server; no merge). Acceptable for v1; multi-user/merge is a future concern.

## Rough size

Medium-large: a new backend service (Fastify + SQLite + blob store + auth), a remote
persistence adapter + runtime mode detection + a login screen, and compose/nginx/release
wiring. Worth splitting the implementation into commits: (1) server + API + tests, (2) remote
adapter + mode detection, (3) login UI, (4) compose/nginx/release wiring + docs.
