# 023 - Release pipeline (versioned Docker images, Sowel-style updates)

## Context

Step A (spec 022) containerizes the app but updates mean rebuilding on the server. To get
Sowel-style updates, we publish a **versioned Docker image** to a registry on each release, so
the server updates with `docker compose pull && up -d` instead of a rebuild.

This is the **infra half** of "updates like Sowel". The **in-app** half (a running instance
detects a new version and applies it in one click) needs a backend and lands with step B
(spec 024). It is deliberately out of scope here - a static SPA cannot self-update its own
container.

## Goal

On a version tag, CI builds and pushes `ghcr.io/mchacher/passepartout:<version>` and `:latest`.
The deployed `docker compose` points at that image, so updating is a pull. The app shows its
version so you can tell what is running.

## Non-goals

- **No in-app update UI / auto-pull** (that is step B, needs the `api` service).
- No multi-arch matrix beyond what the server needs (linux/amd64; arm64 can be added later).
- No change to the app's behavior, engine, or data model.

## Requirements

1. A **release workflow** (`.github/workflows/release.yml`) that on a `v*.*.*` tag builds the
   Docker image and pushes it to `ghcr.io/mchacher/passepartout` tagged with the version and
   `latest`, and creates a GitHub Release. Uses the built-in `GITHUB_TOKEN` (packages: write).
2. The app **displays its version** (from `package.json`), injected at build time (Vite
   `define`), shown subtly in the project menu.
3. **`docker-compose.yml`** documents both modes: `build .` (local, default today) and a
   commented `image: ghcr.io/mchacher/passepartout:latest` for registry-based updates, with the
   `docker compose pull && up -d` update flow.
4. **`docs/self-hosting.md`** documents: updating from the registry, the private-registry login
   the server needs (the repo is private), and how to cut a release (bump version, tag, push).
5. A minimal **`scripts/release.sh`** that bumps the version in `package.json`, commits, tags
   `vX.Y.Z`, and pushes - mirroring Sowel's release ergonomics.
6. The engine and data model are **untouched** (release plumbing only).

## Architecture

```
Release:  git tag vX.Y.Z && git push --tags   (via scripts/release.sh)
  -> .github/workflows/release.yml
     docker/build-push-action -> ghcr.io/mchacher/passepartout:{X.Y.Z, latest}
     + softprops/action-gh-release (a GitHub Release)

Update on the server:
  docker login ghcr.io          # once, private repo needs a read:packages token
  docker compose pull && docker compose up -d

Version in-app:
  vite define __APP_VERSION__ = package.json version  ->  shown in ProjectMenu footer
```

- New: `.github/workflows/release.yml`, `scripts/release.sh`. Edited: `vite.config.ts` (define),
  `src/components/ProjectMenu.tsx` (version label), `docker-compose.yml`, `docs/self-hosting.md`.
  No `src/` logic change beyond showing a string.
- Reuse in B: the same workflow will also build the `api` image (a second build/push step);
  the in-app version check/update endpoint is a B feature that consumes these published tags.

## Acceptance criteria

- [x] Pushing a `vX.Y.Z` tag builds and pushes `ghcr.io/mchacher/passepartout:X.Y.Z` and
      `:latest`, and creates a GitHub Release. (Verified by workflow lint + a dry review; the
      first real publish is a deliberate tag push by the maintainer.)
- [x] The app shows its version (e.g. `v0.1.0`) in the project menu, matching `package.json`.
- [x] `docker-compose.yml` offers the `image:` (registry) mode and documents `pull && up -d`.
- [x] `docs/self-hosting.md` documents registry updates, the private-registry login, and the
      release steps.
- [x] `scripts/release.sh vX.Y.Z` bumps `package.json`, commits, tags and pushes.
- [x] `npm run validate` stays green; the version define does not break the build.

## Edge cases

- **Private registry**: the repo/image are private, so the server must `docker login ghcr.io`
  with a `read:packages` token before `pull`. Documented, not embedded.
- **Version drift**: the image tag comes from the git tag; `scripts/release.sh` bumps
  `package.json` in the same commit it tags, so the in-app version matches the image tag.
- **First release**: nothing is published until the first `vX.Y.Z` tag; until then the compose
  `build .` mode keeps working, so A is never broken.
- **`latest` vs pinned**: `latest` gives easy pulls; the docs note pinning to a version for
  reproducible servers.
- **Missing packages permission**: the workflow sets `permissions: packages: write` so the
  built-in token can push to ghcr without a PAT.
