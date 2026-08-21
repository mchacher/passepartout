# 029 - Public-repo security + production compose

## Context

The repo is now public (Apache-2.0) and its GHCR images are public. That unlocks the
GitHub-native security we could not use on the private free plan, and lets a server pull the
images with no `docker login` / no token. This wires those in.

## Requirements

1. **CodeQL** code scanning (`.github/workflows/codeql.yml`): analyze the frontend + server
   (JavaScript/TypeScript) on push / PR / weekly, reporting under Security.
2. **Dependabot** (`.github/dependabot.yml`): weekly dependency-update PRs + security updates for
   the root npm project, the `server` npm project, and the GitHub Actions.
3. **GitHub-native settings** (via the API, best-effort): enable vulnerability alerts,
   Dependabot security fixes, secret scanning and push protection (free on public repos).
4. **`docker-compose.prod.yml`**: image-mode deploy pulling the public GHCR images (no token, no
   login), `SESSION_SECRET` required, the Docker socket mounted for one-click update; documented
   in `docs/self-hosting.md`.
5. `gitleaks` (spec 028) stays in CI as a broad secret scan alongside GitHub's.

## Acceptance criteria

- [x] CodeQL runs on push/PR and uploads results (public repo).
- [x] Dependabot config is valid (root + server + actions).
- [x] `docker-compose.prod.yml` uses `ghcr.io/mchacher/passepartout(-server):latest`, needs only
      `SESSION_SECRET`, and is documented.
- [x] GitHub-native alerts / secret scanning / push protection enabled where the API allows.
- [x] `npm run validate` + server tests unaffected (CI/infra only).

## Edge cases

- Some native settings may already be on by default for a public repo; the API calls are
  idempotent / best-effort and are not required for the workflows to work.
- CodeQL needs no build step for JS/TS (it extracts directly).
