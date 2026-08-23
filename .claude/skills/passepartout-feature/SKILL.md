---
name: passepartout-feature
description: |
  Creates features for Passepartout — a local-first photo album layout tool that keeps photos' original framing. Use when:
  - User asks to "create a feature", "implement X", "add X" for Passepartout
  - User says "créer une feature", "ajouter une fonctionnalité", "implémenter"
  Specific to Passepartout: the layout engine, per-page controls, whitespace, captions/titles, formats, export.
disable-model-invocation: true
argument-hint: "[description of the feature]"
---

# Passepartout Feature Workflow

Feature request: $ARGUMENTS

Follow EVERY phase below IN ORDER. Each phase has a GATE — a condition that MUST be met before proceeding. Do NOT skip gates. Do NOT combine phases.

All conventions (stack, structure, the one rule) live in `CLAUDE.md` — read it, do not duplicate here. For key files, commands, and templates, see [reference.md](reference.md).

## The one rule (applies to every phase)

**The engine never crops.** It only ever chooses a photo's size and the whitespace around it, and it never changes an aspect ratio. Clipping happens only where the user explicitly asks for it: the per-photo crop tool (spec 015), full-page Fill (spec 012) and decorative masks (spec 018), each off by default. Anything that would crop, clip, or non-proportionally resize a photo as a side effect of layout is wrong by definition — flag it and stop. A crop the user explicitly asks for is a feature, not a violation. This is not a style preference; it is the product.

---

## Phase 1: Understand & Clarify

### 1.1 Read essential context

Before starting, read these IN ORDER:

| Document                | Purpose                                              |
| ----------------------- | ---------------------------------------------------- |
| `CLAUDE.md`             | Entry point — the one rule, stack, structure, conventions |
| `docs/architecture.md`  | The essentials: module map, data model, engine, extension points |
| `docs/overview.md`      | Gentle intro — data model, reactive flow, the layout engine |
| `src/types.ts`          | `Photo`, `AlbumPage`, `PageFormat`, constants        |
| `src/store.ts`          | All state and mutations (Zustand)                    |
| `src/lib/layout.ts`     | The pure layout engine and its invariant             |
| existing `specs/*`      | Scan for a related spec — there may already be a design |

If the feature touches a specific area, also read the relevant component in `src/components/` (see [reference.md](reference.md)).

### 1.2 Deep-dive requirements

**Do not assume. Ask clarifying questions until requirements are crystal clear.** Ask about:

| Topic            | Questions to ask                                                          |
| ---------------- | ------------------------------------------------------------------------ |
| **What**         | Describe the feature in 2-3 sentences. Expected behavior?                |
| **Why**          | What problem does it solve for the photographer?                         |
| **Scope**        | What is included? What is explicitly excluded?                           |
| **Data model**   | New fields on `Photo` / `AlbumPage`? New types in `types.ts`?            |
| **Engine**       | Does it change `computeLayout`? If so, does the ratio invariant still hold? |
| **State**        | New store actions? Which existing ones change?                          |
| **UI**           | New/changed components? Which controls, where (per-page vs global)?      |
| **Edge cases**   | Empty page, no photos, panorama, 1 vs 4 photos, portrait format, huge import? |

**The framing check is a requirement, not an afterthought.** If the request implies filling a fixed slot, clarify how framing is preserved (size + whitespace, no crop the user did not ask for).

### 1.3 Check existing patterns

Grep for similar patterns before designing. Per-page state lives on `AlbumPage`; global state lives at the store root — match the right altitude.

> **GATE 1** — verify ALL:
>
> - [ ] 1.1 Done — read CLAUDE.md, docs/overview.md, types.ts, store.ts, layout.ts
> - [ ] 1.2 Done — asked clarifying questions (or requirements already explicit), including the no-crop implication
> - [ ] 1.3 Done — searched for similar patterns
>
> Do NOT proceed until ALL boxes can be checked.

---

## Phase 2: Document the spec

Every non-trivial feature is documented in `specs/`. English only. (A one-line copy tweak or a single-prop fix may skip to Phase 3 — say so explicitly and get a nod first.)

### 2.1 Create the spec folder

```bash
ls specs/ 2>/dev/null | tail -1   # find last number (starts at 001)
mkdir -p specs/XXX-<feature-name>
```

Convention: `XXX-<feature-name>` — sequential 3-digit number + kebab-case name.

### 2.2 Write the spec files

| File        | Content                                                              |
| ----------- | ------------------------------------------------------------------- |
| `spec.md`   | Context, goals, non-goals, requirements, acceptance criteria, edge cases |
| `plan.md`   | Implementation steps (in the order of 3.2) + **Test Plan**          |

Use the templates in [reference.md](reference.md). For a feature that reshapes the data model or the engine, add a short **Architecture** section inside `spec.md` (flow + files changed) rather than a separate file.

### 2.3 Write the Test Plan (in `plan.md`)

Written BEFORE implementation. For each module with new/changed logic, list nominal cases, edge cases, and — if the engine changes — an explicit **ratio-preservation assertion** and a **fit (no overflow)** assertion.

```markdown
## Test Plan

| Module     | Scenario                                  | Expected                                  |
| ---------- | ----------------------------------------- | ----------------------------------------- |
| layout     | mixed portrait + landscape at density D   | every cell w/h === photo.ratio            |
| layout     | panorama wider than page                  | scaled to fit, ratio intact, no clip      |
| store      | setPageDensity only affects target page   | other pages unchanged                     |
```

**Do NOT skip this.** Engine changes without a ratio test are rejected at Gate 4.

### 2.4 Present a summary to the user

```
## Résumé de la spécification

**Feature**: [Name]
**Scope**: [In scope]
**Data model**: [New fields / types]
**Engine impact**: [None | changes computeLayout — invariant preserved because …]
**UI**: [New/changed controls, per-page or global]
**Tests**: [Modules + number of scenarios]

Voulez-vous que j'implémente cette feature ?
```

> **GATE 2** — verify ALL:
>
> - [ ] 2.1 Done — `specs/XXX-name/` exists
> - [ ] 2.2 Done — `spec.md` written (requirements, acceptance criteria, scope, edge cases)
> - [ ] 2.2 Done — `plan.md` written (implementation steps)
> - [ ] 2.3 Done — Test Plan written in `plan.md` (with ratio + fit assertions if the engine changes)
> - [ ] 2.4 Done — summary presented in the exact format
> - [ ] User explicitly approved ("oui", "yes", "go")
>
> Do NOT implement without explicit approval. Questions → update spec and re-present.

---

## Phase 3: Branch & implement

### 3.1 Create a feature branch (MANDATORY)

**ALWAYS branch. NEVER commit directly to main.** Verify the current branch right before committing (parallel work can swap it).

```bash
git checkout main && git pull --ff-only 2>/dev/null; git checkout -b feat/<feature-name>
```

Prefixes: `feat/`, `fix/`, `refactor/`, `docs/`.

### 3.2 Implement in order

Strict order to avoid broken dependencies:

1. **Types first** — `src/types.ts` (fields, unions, constants)
2. **Engine / pure lib** — `src/lib/*.ts` (keep it pure and framework-free)
3. **Engine tests** — `src/lib/*.test.ts` (write them with the logic, per the Test Plan)
4. **Store** — `src/store.ts` state + actions (components never mutate state directly)
5. **Components** — `src/components/*`, wire into `App.tsx`; Tailwind semantic tokens only

### 3.3 Rules (non-negotiable, full list in `CLAUDE.md`)

- TypeScript strict, no `any`.
- The layout engine stays **pure** (no DOM, no React) and **ratio-preserving**.
- `crypto.randomUUID()` for ids.
- Tailwind utilities via semantic tokens (`bg-surface`, `text-ink`, …); palette stays in `src/index.css`, both themes.
- All user-facing copy in **English**, no em-dashes / en-dashes.

> **GATE 3** — verify ALL:
>
> - [ ] 3.1 Done — on a feature branch (verify `git branch --show-current`), NOT main
> - [ ] 3.2 Done — implemented in order (types → engine → engine tests → store → components)
> - [ ] 3.2 Done — every Test Plan scenario has a matching test
> - [ ] 3.3 Done — rules respected (strict TS, pure ratio-preserving engine, tokens, English copy)

---

## Phase 4: Validate

**Do NOT commit without ALL checks green.**

```bash
npm run validate     # tsc --noEmit + eslint + vitest run
```

If you prefer them individually: `npm run typecheck`, `npm run lint`, `npm run test`.

> **GATE 4** — verify ALL:
>
> - [ ] `npm run typecheck` — ZERO errors
> - [ ] `npm run lint` — ZERO errors (warnings acceptable)
> - [ ] `npm run test` — ALL tests pass, including the ratio + fit assertions
>
> Do NOT proceed if any check fails. Fix first.

---

## Phase 5: Verify in the real app (MANDATORY)

Passepartout has **no React component tests** — the engine is unit-tested, the UI is verified by driving it. Never claim a UI feature works from typecheck alone.

### 5.1 Run and drive the changed flow

```bash
npm run build && npm run preview    # serves the built app (default http://localhost:4173)
```

Use Playwright (or a manual pass) to exercise the exact surface you changed: import or **Load an example**, then operate the new control and observe the result. Take a screenshot.

### 5.2 Confirm the invariant visually

Check that no photo is cropped or distorted: a portrait stays portrait, a panorama stays panorama, whitespace absorbs the differences. Verify both a light and a dark render if the change touches styling.

Stop any preview server you started and remove throwaway screenshots when done.

> **GATE 5** — verify ALL:
>
> - [ ] 5.1 Done — built, ran, and drove the changed flow in a real browser
> - [ ] 5.2 Done — confirmed visually that framing is intact (no crop/distortion)
> - [ ] Cleaned up (preview stopped, temp screenshots removed)

---

## Phase 6: Review & commit

### 6.1 Self / agent review of the diff

Review `git diff main...HEAD` (or the working tree) against the spec. For anything beyond a trivial change, spawn a review subagent (Agent tool — `code-review` skill or a `general-purpose` agent) scoped to the diff, given the spec and this checklist:

- **Correctness**: logic bugs; edge cases from the spec (empty page, panorama, 1 vs 4 photos, portrait format, large import).
- **The invariant**: no code path crops, clips, or non-proportionally resizes; the engine stayed pure.
- **Conventions** (`CLAUDE.md`): strict TS/no `any`, `crypto.randomUUID()`, semantic Tailwind tokens, English copy, no dashes.
- **Scope**: the diff does only what the spec says — no unrelated refactors.
- **Tests**: every Test Plan scenario is covered; ratio + fit assertions present if the engine changed.

Fix every blocking finding. If code changed, **re-run Phase 4** (and Phase 5 if UI changed).

### 6.2 Update the spec + docs

- Mark acceptance criteria `[x]` in `specs/XXX/spec.md`, tasks `[x]` in `plan.md`.
- **Keep `docs/architecture.md` current.** It is the essentials-only, always-true
  architecture reference. If this feature changed the data model, the engine, the
  module map, a boundary, or an extension point, fold the **essential** change into
  it now — a line or two, not a changelog. The detail belongs in `specs/XXX/`; only
  the durable shape belongs here. If nothing architectural changed, leave it.
- If behavior or the data model changed, also update `docs/overview.md` and the
  `README.md` feature list if user-facing. `CLAUDE.md` for stack/convention shifts.

### 6.3 Commit

Conventional commits. **No `Co-Authored-By` lines. No "Generated with Claude" mention.** Verify the branch right before committing.

```bash
git branch --show-current           # confirm it is the feature branch
git add <specific files>
git commit -m "feat(<scope>): description

What and why."
```

Scopes: `engine`, `store`, `ui`, `types`, `export`, `import`, `exif`, `docs`, `build`.

> **GATE 6** — verify ALL:
>
> - [ ] 6.1 Done — diff reviewed against the spec; blocking findings fixed; Phase 4/5 re-run if code changed
> - [ ] 6.2 Done — spec checkboxes updated; `docs/architecture.md` folded the essential change (or nothing architectural changed); docs/README updated if applicable
> - [ ] 6.3 Done — committed on the feature branch (conventional, no Co-Authored-By)

---

## Phase 7: Integrate (wait for approval)

**CRITICAL: do NOT merge into main without explicit user confirmation.**

Determine the integration path:

```bash
git remote -v    # is there a remote?
```

- **Remote exists** → push and open a PR, then ask:

  ```bash
  git push -u origin feat/<feature-name>
  gh pr create --title "feat: description" --body "Summary + Changes + Test plan + Verified in-app"
  ```

  > "PR créée: [URL]. Voulez-vous que je merge dans main ?"

- **No remote (local-only)** → present the diff (`git --no-pager diff main...HEAD --stat` + highlights) and ask:

  > "Prêt à merger `feat/<feature-name>` dans main ? (diff ci-dessus)"

Only after explicit approval ("oui" / "merge" / "go"):

```bash
git checkout main
git merge --no-ff feat/<feature-name>
# with remote: gh pr merge <n> --merge --delete-branch  (then git checkout main && git pull)
```

> **GATE 7** — verify ALL:
>
> - [ ] User explicitly approved the merge
> - [ ] Merged into main; feature branch cleaned up
> - [ ] On main, up to date

---

## Gate summary

| Gate  | Condition                          | If skipped                     |
| ----- | ---------------------------------- | ------------------------------ |
| **1** | Requirements clear (incl. no-crop) | Wrong feature built            |
| **2** | User approved the spec             | Wasted implementation          |
| **3** | Code on a feature branch, in order | Direct commits to main         |
| **4** | tsc + lint + tests pass            | Broken code committed          |
| **5** | Verified in the real app          | UI claimed working but is not  |
| **6** | Diff reviewed, docs updated        | Avoidable bugs, stale docs     |
| **7** | User approved the merge            | Unauthorized merge             |