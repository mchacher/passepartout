# Release notes

Newest first. Each release has a `## vX.Y.Z` section; adding one is required before a tag can
be published (the release workflow refuses to publish without it - spec 028).

## v0.2.0 — 2026-08-21

First self-hostable release.

- **Self-hosting with Docker**: run Passepartout on your own server with `docker compose up -d`,
  behind your reverse proxy. See [self-hosting.md](self-hosting.md).
- **Server-backed data (optional)**: with the `api` service, albums and photos live on the
  server and are shared across devices; without it, Passepartout stays local-first (data in the
  browser).
- **User accounts**: a first-run setup creates the first account; everyone then signs in with
  their own username and password (all accounts equal). Manage accounts from the Admin menu.
- **In-app updates**: a server instance shows its version and can check for and apply a new
  release - one click when the Docker socket is mounted, otherwise the manual command.
- **Backup and transfer**: export a whole album as a `.zip` bundle and import it into another
  instance.
- The studio itself: no-crop layouts, opt-in crop / mask / frame / tilt decorations, a book
  preview with a flat cover wrap, and print-ready Blurb PDF export.
