# 022 - Self-hosting (Docker) - step A toward a server

## Context

Passepartout is a static single-page app (`vite build` -> `dist/`, no backend). Today it is
only run via `npm run dev` / `preview`. To host it on a personal server (a VM, next to Sowel)
and get Sowel-style deploy/update ergonomics, we containerize the built app behind a small web
server.

This is **step A** of a two-step plan (see `docs/self-hosting.md`): A hosts the *app* (data
stays in each browser's IndexedDB, local-first); a later **step B** adds a backend service so
the data lives on the server. A is deliberately shaped so B slots in without redoing the infra.

## Goal

A production image and a `docker compose` setup that build the app and serve it over HTTP, so
`docker compose up -d` on the server gives a working Passepartout at a chosen port/URL, and
updating is `git pull` + rebuild (or, later, an image pull).

## Non-goals

- **No backend, no data on the server** (that is step B). Albums still live in the browser.
- No TLS/reverse-proxy config baked in: the host's existing proxy (Caddy/Traefik/nginx, as for
  Sowel) terminates TLS and forwards to the container. We only expose plain HTTP.
- No CI image publishing in this step (can be added later for `docker compose pull` updates).
- No change to the app's behavior, engine, or data model.

## Requirements

1. A **multi-stage `Dockerfile`**: stage 1 builds the app (`npm ci` + `npm run build`); stage 2
   serves `dist/` with a small static server (nginx alpine).
2. The web server does **SPA fallback** (`try_files ... /index.html`) so deep links work, gzips
   text assets, long-caches the content-hashed assets, and **never caches `index.html`** so a
   redeploy is picked up on the next refresh.
3. A **`docker-compose.yml`** with a single `web` service (build + published port +
   `restart: unless-stopped`), and a **commented `api` placeholder + `/api` proxy** so step B is
   an additive edit, not a rewrite.
4. A **`.dockerignore`** that keeps the build context small and reproducible (no
   `node_modules`, `.git`, `dist`, docs, specs, screenshots).
5. Short **`docs/self-hosting.md`**: how to build/run/update, the chosen port, the reverse-proxy
   note, and an explicit statement that data is per-browser until step B.
6. The engine and data model are **untouched** (this is packaging only; no photo is ever
   cropped or resized).

## Architecture

```
Dockerfile (multi-stage)
  build   : node:20-alpine -> npm ci -> npm run build -> /app/dist
  runtime : nginx:alpine   -> COPY dist -> /usr/share/nginx/html + nginx.conf

docker-compose.yml
  web : build ., ports "8080:80", restart unless-stopped
  # api : (step B) Fastify + SQLite + blob volume; nginx proxies /api -> api

nginx.conf
  gzip; SPA try_files /index.html; cache hashed assets long, index.html no-store;
  # location /api/ { proxy_pass http://api:3000/; }   # uncommented in step B
```

- Files added at the repo root: `Dockerfile`, `.dockerignore`, `docker-compose.yml`,
  `docker/nginx.conf`. Doc: `docs/self-hosting.md`. No `src/` change.
- Reuse in B: the same compose gains an `api` service; nginx uncomments the `/api` proxy; the
  frontend swaps `src/persistence.ts` from IndexedDB to the API. The Dockerfile build stage is
  unchanged; a backend build stage is added alongside.

## Acceptance criteria

- [x] `docker build` produces an image that serves the app; visiting the published port shows
      the working Passepartout (load an example, edit, preview).
- [x] A deep link / refresh on a non-root path serves the app (SPA fallback), not a 404.
- [x] `index.html` is served with a no-store cache header; hashed `assets/*` are long-cached.
- [x] `docker compose up -d` brings the app up on the documented port; `down` stops it.
- [x] `.dockerignore` excludes `node_modules`, `.git`, `dist`, `docs`, `specs`, screenshots.
- [x] `docker-compose.yml` carries a commented `api`/`/api`-proxy placeholder for step B.
- [x] `docs/self-hosting.md` documents build/run/update, the port, the proxy note, and the
      "data is per-browser until step B" caveat.

## Edge cases

- **Update flow**: a redeploy must not serve a stale bundle. Hashed asset filenames + a
  no-store `index.html` guarantee the new bundle loads on the next refresh.
- **Reverse proxy in front**: the container speaks plain HTTP on one port; TLS and the public
  hostname are the host proxy's job (same pattern as Sowel). Documented, not baked in.
- **Build reproducibility**: `npm ci` against the committed lockfile; `.dockerignore` keeps a
  local `dist/` or `node_modules` from leaking into the image.
- **Base path**: served at the domain root (`base: "/"`, the Vite default), matching a
  dedicated subdomain; a sub-path deployment is out of scope for A.
