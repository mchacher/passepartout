---
name: passepartout-issue
description: |
  Handles a GitHub issue end-to-end for Passepartout: qualify it, rewrite its write-up, implement the fix or feature, open the PR, and close the issue on merge. Use when:
  - User points at an issue ("traite l'issue 42", "regarde les issues ouvertes")
  - User asks to triage, qualify, or clean up the issue tracker
disable-model-invocation: true
argument-hint: "[issue number or search terms]"
---

# Passepartout GitHub Issue Workflow

Issue to handle: $ARGUMENTS

Follow the phases IN ORDER. Each has a GATE — meet it before moving on. Do NOT jump straight to code.

Conventions (stack, structure, branch) live in `CLAUDE.md` — read it first, do not duplicate. Real features run through the `passepartout-feature` skill; this workflow qualifies, rewrites, and ships the small ones itself. The default branch is **master**.

## The one rule (applies throughout)

**The engine never crops.** It only ever chooses a photo's size and the whitespace around it, and it never changes an aspect ratio. Clipping happens only where the user explicitly asks for it: the per-photo crop tool (spec 015), full-page Fill (spec 012) and decorative masks (spec 018), each off by default. Anything that would crop, clip, or non-proportionally resize a photo as a side effect of layout is wrong by definition — flag it and stop. A crop the user explicitly asks for is a feature, not a violation.

All written output on GitHub (issue body, comments, commits, PR) is in **English**, no em-dashes or en-dashes.

---

## Phase 1: Qualify

```bash
gh issue view <n> --comments          # full thread
gh issue list --state open --limit 30 # if no number given: pick with the user
```

- **Classify**: bug / feature / docs / question / duplicate / invalid.
- **Locate it in the code**: for a bug, find (and if possible reproduce) the failing path; read the relevant `src/lib/*` or `src/components/*` and any related `specs/*`. For a feature, check whether a spec already covers it.
- **Check duplicates**: `gh issue list --state all --search "<keywords>"`.
- **Note missing info**: repro steps, expected vs actual, screenshot, which photos/format.

Present a short qualification:

```
## Qualification issue #<n>

**Type**: bug | feature | docs | question | duplicate of #<m> | invalid
**Area**: engine | store | ui | export | import | exif | build
**Value / severity**: <user value for a feature, impact for a bug>
**Root cause / design hint**: <what reading the code revealed, or "needs a repro">
**No-crop check**: <does any proposed fix risk the invariant? — usually "no">
**Missing info**: <what to ask the reporter, if anything>
**Proposed path**: quick fix (this skill) | passepartout-feature | close (duplicate/invalid)
```

> **GATE 1**: User agrees with the qualification and the path. If info is missing, `gh issue comment` to ask for it and STOP until answered.

---

## Phase 2: Rewrite the write-up

The rewritten issue is the spec of the fix.

- **Title**: imperative and specific (`Insert a page at any position`, not "pages bug").
- **Body**: Context / Desired / Acceptance criteria / Technical notes (the code pointers from Phase 1).
- If someone else wrote it, keep their words at the bottom in a `<details><summary>Original report</summary>…</details>` block — never silently erase a reporter's text.
- Labels: `gh issue edit <n> --add-label bug|enhancement|documentation`.

```bash
gh issue edit <n> --title "..." --body-file /tmp/issue-<n>.md
```

> **GATE 2**: Rewritten title + body shown to the user and approved BEFORE `gh issue edit` runs.

---

## Phase 3: Implement

If Phase 1 routed this to **passepartout-feature** (real data-model / engine / UI-surface feature), run that skill now and skip to Phase 5. Otherwise, ship the small fix here:

```bash
git checkout master && git pull --ff-only
git checkout -b fix/issue-<n>-<slug>     # or feat/issue-<n>-<slug>
```

- Implement in order: **types → pure lib (+ its tests) → store → components** (see `passepartout-feature` / `CLAUDE.md`).
- Keep the layout engine **pure and ratio-preserving**. Strict TS, no `any`. `crypto.randomUUID()` for ids. Tailwind semantic tokens, both themes. English copy, no dashes.
- **Tests are mandatory.** A bug fix gets a regression test that fails before the fix; new pure logic gets unit tests.
- Reference the issue in the commit body: `fix(engine): keep panorama ratio at high density (#<n>)`.

```bash
npm run validate     # tsc --noEmit + eslint + vitest run
```

> **GATE 3**: On a feature branch (verify `git branch --show-current` right before committing). `npm run validate` green (lint warnings acceptable, zero errors). Every changed behavior has a test.

---

## Phase 4: Verify in the real app (MANDATORY)

Passepartout has **no React component tests** — the engine is unit-tested, the UI is verified by driving it. Never claim a UI fix works from typecheck alone.

```bash
npm run build && npm run preview    # default http://localhost:4173
```

- Drive the exact surface you changed (import photos or **Load an example**, operate the control, observe the result). Use Playwright or a manual pass; take a screenshot.
- Confirm the invariant visually: nothing cropped or distorted; whitespace absorbs the differences. Check light and dark if styling changed.
- Stop the preview server and remove throwaway screenshots when done.

> **GATE 4**: Built, ran, and drove the changed flow in a real browser; framing confirmed intact; cleaned up.

For anything beyond a trivial change, also skim `git diff master...HEAD` (or spawn a `code-review` / `general-purpose` review agent) for correctness, the invariant, scope creep, and convention slips. Fix blocking findings and re-run Phase 3/4.

---

## Phase 5: PR & close the loop

```bash
gh pr create --title "<conventional title> (#<n>)" --body "...

Closes #<n>"
```

- The body explains the root cause (bug) or design (feature), lists the tests added, notes it was verified in-app, and contains `Closes #<n>` so the merge auto-closes the issue.
- Present the PR and **wait for explicit approval before merging** ("oui" / "merge" / "go"). Never merge on your own.

After merge:

1. Confirm the issue auto-closed (`gh issue view <n>`); close it with a one-line comment if not.
2. If the fix changed user-facing behavior, it needs a line in the next release: add it under the pending `## vX.Y.Z` section of `docs/release-notes.md` (a release is cut later with `scripts/release.sh` — see the `passepartout-feature` reference).

> **GATE 5**: PR approved and merged; issue closed and the reporter informed; a release-notes line queued if behavior changed.

---

## Gate summary

| Gate  | Condition                                   | If skipped                    |
| ----- | ------------------------------------------- | ----------------------------- |
| **1** | Qualification + path agreed (incl. no-crop) | Wrong work done               |
| **2** | Rewritten issue approved                    | Reporter's words lost / vague |
| **3** | Feature branch, validate green, tests added | Broken / untested code        |
| **4** | Verified by driving the real app            | UI claimed working but is not |
| **5** | User approved merge; issue closed           | Unauthorized merge, loose end |
