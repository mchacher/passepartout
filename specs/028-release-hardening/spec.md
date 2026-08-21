# 028 - Release hardening: release-notes gate + secret scan

## Context

Two guardrails around releases, matching Sowel's practice:

1. **Maintain release notes**, and make their presence a **condition for publishing** a release
   (Sowel's `verify-release-notes`).
2. **Never leak a password/secret**: scan every push/PR for committed secrets (Sowel uses
   gitleaks).

## Requirements

1. **`docs/release-notes.md`**: a human-maintained changelog, newest first, one `## vX.Y.Z`
   section per release.
2. **Release gate**: the release workflow refuses to publish (before building any image) if
   `docs/release-notes.md` has no `## v<tag>` section. `scripts/release.sh` checks the same
   thing locally and refuses to tag without a note.
3. **Secret scan**: a CI job (`gitleaks`) runs on every push and pull request and fails on a
   detected secret, so a password/token can't slip into the repo.
4. No change to the app; this is repo/release plumbing.

## Architecture

```
CI (ci.yml): validate | server | security (gitleaks secret scan)  -- on push/PR
Release (release.yml): verify-notes (grep docs/release-notes.md for ## v<tag>) -> publish
scripts/release.sh: refuse to tag if the note is missing (fast local feedback)
```

- Private repo on the free plan: GitHub branch protection and CodeQL/Advanced Security are not
  available, so the secret scan uses **gitleaks** (a standard Action that works on private repos
  for a personal account, no license). GitHub-native secret scanning + Dependabot can be turned
  on later in repo settings if the plan allows.

## Acceptance criteria

- [x] Pushing a `vX.Y.Z` tag with no `## vX.Y.Z` in `docs/release-notes.md` fails the release
      (nothing published); adding the note makes it pass.
- [x] `scripts/release.sh X.Y.Z` refuses when the note is missing.
- [x] The `security` CI job scans for secrets on push/PR and fails on a hit.
- [x] `docs/release-notes.md` exists with a `## v0.2.0` entry (the first release).

## Edge cases

- **Tag without a note**: `verify-notes` fails first, before any Docker build - no partial
  publish.
- **False positive in gitleaks**: allow-list via a `.gitleaks.toml` if a legitimate string
  trips it (none today).
- **Grep anchor**: the note heading is exactly `## vX.Y.Z` (optionally followed by a space +
  date), which both the workflow and the script match.
