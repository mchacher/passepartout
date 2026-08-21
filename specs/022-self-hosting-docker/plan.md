# 022 - Self-hosting (Docker) - implementation plan

## Steps (in order)

1. **`.dockerignore`** - exclude `node_modules`, `.git`, `.github`, `.claude`, `dist`,
   `docs`, `specs`, `*.md`, screenshots, `.playwright-mcp`, editor cruft. Keep everything
   the build needs (source, `index.html`, configs, `package*.json`).
2. **`docker/nginx.conf`** - server block: `listen 80`; `root /usr/share/nginx/html`; gzip on
   for text types; `location /` with `try_files $uri $uri/ /index.html`; `index.html` served
   `Cache-Control: no-store`; `assets/` (content-hashed) served `immutable`, 1 year; a
   commented `location /api/ { proxy_pass http://api:3000/; }` for step B.
3. **`Dockerfile`** (multi-stage):
   - `build`: `node:20-alpine`, copy `package*.json`, `npm ci`, copy the rest, `npm run build`.
   - runtime: `nginx:1.27-alpine`, copy `--from=build /app/dist` to the web root, copy
     `docker/nginx.conf` to `/etc/nginx/conf.d/default.conf`, expose 80.
4. **`docker-compose.yml`** - `web` service (`build: .`, `ports: "8080:80"`,
   `restart: unless-stopped`), plus a commented `api` service + volume placeholder and a note
   that step B uncomments the `/api` proxy in `nginx.conf`.
5. **`docs/self-hosting.md`** - build/run/update commands, the port (8080), the reverse-proxy
   note (host proxy terminates TLS -> container:80), and the "data is per-browser until step B"
   caveat. Link it from the README.

## Test Plan

No unit tests apply (packaging only; no `src/` change, so `npm run validate` stays green by
construction). Verification is by building and running the image:

| Check | How | Expected |
| ----- | --- | -------- |
| Image builds | `docker build -t passepartout:test .` | succeeds, no error |
| App served | `docker run -p 8080:80` then GET `/` | 200, the app HTML/JS loads and runs |
| SPA fallback | GET a deep path e.g. `/anything` | 200 + `index.html` (not 404) |
| Cache headers | `curl -I` on `/` and on an `/assets/*.js` | `index.html` no-store; asset immutable/long |
| Compose up | `docker compose up -d` then open the port | app reachable; `down` stops it |

Engine invariant: N/A - no engine or ratio code is touched (packaging only). Noted per the
workflow.

## Verification (Phase 5)

- `docker build` the image, `docker run` it, and drive the served app in a browser: load an
  example, edit a page, open the preview - it works exactly as `npm run preview`.
- `curl -I` the root and a hashed asset to confirm the cache headers.
- `docker compose up -d` / `down` round-trip.
