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

```bash
git pull
docker compose up -d --build
```

The build output is content-hashed and `index.html` is served with `Cache-Control: no-store`,
so browsers pick up the new version on the next refresh (no stale bundle).

## Data lives in the browser

Passepartout is local-first: your albums and photos are stored in the browser's IndexedDB, per
device and per browser profile. Hosting the app does **not** put the data on the server. To
move an album between devices today, use **Export / Import** in the project menu (a
`.passepartout.zip` bundle - spec 021).

### Step B: server-backed data (later)

A future step adds a backend service so the data lives on the server (shared across devices,
with Sowel-style managed updates). The infra here is shaped for it: `docker-compose.yml` has a
commented `api` service and `docker/nginx.conf` a commented `/api` proxy; the app would then
swap its single persistence adapter (`src/persistence.ts`) from IndexedDB to that API. See
`specs/022-self-hosting-docker/spec.md`.
