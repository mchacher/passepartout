# 023 - Release pipeline - implementation plan

## Steps (in order)

1. **`vite.config.ts`** - add `define: { __APP_VERSION__: JSON.stringify(pkg.version) }`
   (read `package.json` version). Declare `__APP_VERSION__` for TS (a `src/vite-env.d.ts` or an
   inline `declare const`).
2. **`src/components/ProjectMenu.tsx`** - show `v${__APP_VERSION__}` subtly in the panel footer.
3. **`.github/workflows/release.yml`** - on `push: tags: ['v*.*.*']`:
   - `permissions: { contents: write, packages: write }`
   - checkout; `docker/login-action` to ghcr with `${{ github.actor }}` / `GITHUB_TOKEN`;
   - `docker/metadata-action` to derive tags (`type=semver` + `latest`);
   - `docker/build-push-action` (context `.`, push true, the derived tags, linux/amd64);
   - `softprops/action-gh-release` to create the Release.
4. **`docker-compose.yml`** - keep `build .` as default; add a commented
   `image: ghcr.io/mchacher/passepartout:latest` alternative and a header note on the
   `pull && up -d` update flow.
5. **`docs/self-hosting.md`** - a "Updating from the registry" section (login + pull), and a
   "Cutting a release" section (`scripts/release.sh` / tag / what CI does).
6. **`scripts/release.sh`** - `set -euo pipefail`; take `vX.Y.Z`; `npm version` (or edit
   package.json) without a git tag, commit `release: vX.Y.Z`, `git tag vX.Y.Z`, `git push` +
   `git push --tags`. Guard: clean tree, on a release-able branch.

## Test Plan

Release plumbing; no unit tests apply. `npm run validate` must stay green (the version define
must not break tsc/build). Verification is by build + static workflow review:

| Check | How | Expected |
| ----- | --- | -------- |
| Build not broken | `npm run build` / `npm run validate` | green; `__APP_VERSION__` compiles |
| Version shown | run the built app | the project menu shows `v0.1.0` (== package.json) |
| Image bakes the version | `docker build` + run + read the UI | version visible, matches package.json |
| Workflow valid | YAML parse / `actionlint` if available; manual review | well-formed; correct tags/permissions |
| release.sh | `bash -n scripts/release.sh` (syntax) + dry read | no syntax error; bumps + tags + pushes |

Engine invariant: N/A - no engine/ratio code touched. Noted per the workflow.

The first **real** publish (an actual `vX.Y.Z` tag push that triggers the workflow) is a
deliberate maintainer action, not part of this PR's verification, to avoid cutting a release
without an explicit go.

## Verification (Phase 5)

- `npm run validate` green; `npm run build` shows the version compiles.
- Build the Docker image, run it, confirm the project menu shows `v0.1.0`.
- Review `release.yml` for correct triggers, permissions, ghcr login and tag derivation;
  `bash -n scripts/release.sh`.
