# Self-hosting Passepartout

Passepartout is a static single-page app. You can host it on your own server (a VM, next to
Sowel) with Docker. This is **step A**: it hosts the *app*. Albums still live in each
browser's local storage (IndexedDB), not on the server - see [Data lives in the browser](#data-lives-in-the-browser)
below and the step B note.

## Requirements

- Docker with Compose v2 (`docker compose ...`).

## Run

From the repository root:

```bash
docker compose up -d --build
```

The app is served at `http://<host>:8080`. Change the published port in
[`docker-compose.yml`](../docker-compose.yml) (the `"8080:80"` mapping) if you like.

Stop it with `docker compose down`.

## Behind a reverse proxy (TLS)

The container speaks plain HTTP on port 80. Terminate TLS and attach your public hostname at
your existing reverse proxy (Caddy, Traefik, or nginx - the same pattern you use for Sowel)
and forward to the container. For example, with Caddy:

```
passepartout.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

## Updating

Two ways, depending on whether you build on the server or pull a published image.

**Build on the server** (the default `docker-compose.yml`):

```bash
git pull
docker compose up -d --build
```

**Pull a published image** (Sowel-style, recommended once releases exist - spec 023): each
release publishes `ghcr.io/mchacher/passepartout:<version>` and `:latest`. In
`docker-compose.yml`, comment out `build:` on the `web` service and set
`image: ghcr.io/mchacher/passepartout:latest` (or pin a version). Then:

```bash
docker login ghcr.io            # once: the repo is private, use a read:packages token
docker compose pull
docker compose up -d
```

Either way, the build output is content-hashed and `index.html` is served with
`Cache-Control: no-store`, so browsers pick up the new version on the next refresh (no stale
bundle). The app's version is shown in the project menu.

## Cutting a release

From a clean working tree on `master`:

```bash
scripts/release.sh 0.2.0
```

It bumps `package.json`, commits `release: v0.2.0`, tags `v0.2.0` and pushes. The tag triggers
`.github/workflows/release.yml`, which builds and pushes the image to GHCR and creates a GitHub
Release. Servers then update with `docker compose pull && up -d` (above).

## Two data modes

Passepartout runs in one of two modes, decided at page load by probing `/api/health`:

- **Server mode (spec 024)** - when the `api` service is running, albums and photos live on the
  server (SQLite + a blob volume), shared across every browser that logs in. This is the
  default `docker-compose.yml`.
- **Local mode** - with no `api` service, the app is local-first: albums live in each browser's
  IndexedDB, per device. To move an album between local instances, use **Export / Import** in
  the project menu (a `.passepartout.zip` bundle - spec 021).

### Server mode

The default compose runs both `web` and `api`. Set the password and cookie secret before you
start (a `.env` file next to `docker-compose.yml` works):

```bash
PASSEPARTOUT_PASSWORD=your-household-password
SESSION_SECRET=a-long-random-string
```

Then `docker compose up -d --build`. Open the instance; you get a **single-password login**.
After login, projects and photos are stored server-side and any other browser that logs in
sees the same albums. Data persists in the `passepartout-data` Docker volume across container
recreates. Migrate an existing local album up with **Import** (a `.passepartout.zip` bundle).

To run **local mode** instead (data in the browser), remove the `api` service from
`docker-compose.yml`; the SPA's `/api` probe then fails and it uses IndexedDB.

> Multi-user accounts, offline, and the in-app "update available" button are out of scope for
> this step (single password, pure server). See `specs/024-server-backend/spec.md`.
