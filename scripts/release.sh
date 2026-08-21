#!/usr/bin/env bash
# Cut a Passepartout release (spec 023): bump package.json, commit, tag vX.Y.Z and push.
# Pushing the tag triggers .github/workflows/release.yml, which builds and publishes
# ghcr.io/mchacher/passepartout:{X.Y.Z,latest} and creates a GitHub Release.
#
# Usage: scripts/release.sh 0.2.0     (or: scripts/release.sh v0.2.0)
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "usage: scripts/release.sh <X.Y.Z>" >&2
  exit 1
fi

# Accept "0.2.0" or "v0.2.0"; normalize to the bare version.
version="${1#v}"
if ! printf '%s' "$version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "error: version must be X.Y.Z (got '$1')" >&2
  exit 1
fi
tag="v$version"

# Run from the repo root.
cd "$(dirname "$0")/.."

if [ -n "$(git status --porcelain)" ]; then
  echo "error: working tree is not clean; commit or stash first" >&2
  exit 1
fi

if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
  echo "error: tag $tag already exists" >&2
  exit 1
fi

# Bump package.json (and package-lock.json) without letting npm create the tag itself.
npm version "$version" --no-git-tag-version >/dev/null
git add package.json package-lock.json
git commit -m "release: $tag"
git tag "$tag"

echo "Committed and tagged $tag. Pushing..."
git push
git push origin "$tag"

echo "Done. CI will publish ghcr.io/mchacher/passepartout:{$version,latest} and a GitHub Release."
