# Passepartout Feature Reference

Quick reference for the `passepartout-feature` skill. Full workflow: [SKILL.md](SKILL.md).

## Where to find things

| Topic                    | File                          |
| ------------------------ | ----------------------------- |
| **Entry point / rules**  | `CLAUDE.md`                   |
| **Architecture (essentials)** | `docs/architecture.md`   |
| **Overview / flow**      | `docs/overview.md`            |
| **Layout catalog**       | `src/lib/layouts.ts`          |
| **Types**                | `src/types.ts`                |
| **Store (state + actions)** | `src/store.ts`             |
| **Layout engine (pure)** | `src/lib/layout.ts`           |
| **Engine tests**         | `src/lib/layout.test.ts`      |
| **EXIF capture time**    | `src/lib/exif.ts`             |
| **Demo images**          | `src/lib/demo.ts`             |
| **Feature specs**        | `specs/XXX-feature-name/`     |

## Components

| Part                              | File                            |
| --------------------------------- | ------------------------------- |
| App shell (empty state + pages)   | `src/App.tsx`                   |
| Top bar (import, format, arrange) | `src/components/TopBar.tsx`     |
| Library (photo tray, drag source) | `src/components/Library.tsx`    |
| Page card (title, count, whitespace, delete) | `src/components/PageCard.tsx` |
| Paper (measured page render)      | `src/components/Paper.tsx`      |
| Drag-and-drop payload key         | `src/components/dnd.ts`         |
| Design tokens (both themes)       | `src/index.css`                 |

## Reactive flow

```
Import / demo
  -> store.photos (sorted by capture time)
    -> store.pages (auto-distributed; each page has its own density)
      -> PageCard controls (title, count 1-4, per-page whitespace, delete)
        -> Paper measures its content box in pixels
          -> computeLayout(items, w, h, { density })   [PURE]
            -> centered rows, every ratio intact, whitespace around
```

State altitude: **per-page** settings live on `AlbumPage` (e.g. `density`, `title`); **album-wide** settings live at the store root (e.g. `format`). Put new state at the right level.

## Commands

| Action              | Command                              |
| ------------------- | ------------------------------------ |
| Dev server          | `npm run dev` (http://localhost:5180) |
| Build (static)      | `npm run build`                      |
| Preview built app   | `npm run preview` (http://localhost:4173) |
| Type check          | `npm run typecheck`                  |
| Lint                | `npm run lint`                       |
| Tests               | `npm run test`                       |
| Single test file    | `npx vitest run src/lib/<file>.test.ts` |
| Full validate       | `npm run validate`                   |

## Spec templates

### spec.md

```markdown
# Spec XXX — Feature Name

## Context

Why this feature exists, what problem it solves for the photographer.

## Goals

1. Goal 1
2. Goal 2

## Non-Goals

- What is explicitly NOT included

## Requirements

### R1 — Name

Behavior, data flow. State how framing is preserved (size + whitespace, never crop).

## Acceptance Criteria

- [ ] Criterion 1
- [ ] No photo is cropped, clipped, or non-proportionally resized

## Edge Cases

- Empty page / no photos
- Panorama wider than the page
- 1 vs 4 photos on a page
- Portrait format
- Large import

## Architecture (only if the data model or engine changes)

Flow + files changed table.
```

### plan.md

```markdown
# Implementation Plan — Spec XXX

## Steps (in build order)

1. Types — `src/types.ts`: …
2. Engine — `src/lib/…`: … (stays pure, ratio-preserving)
3. Engine tests — `src/lib/….test.ts`: …
4. Store — `src/store.ts`: …
5. Components — `src/components/…`, wire into `App.tsx`

## Test Plan

| Module | Scenario | Expected |
| ------ | -------- | -------- |
| layout | mixed portrait + landscape | every cell w/h === photo.ratio |
| layout | panorama wider than page   | scaled to fit, ratio intact, no clip |
| store  | <action> only affects target | other entities unchanged |

## Validation

- `npm run validate` (tsc + lint + tests)
- Verified in the real app (Phase 5): drove <flow>, screenshot, framing intact
```

## Commit scopes

`engine`, `store`, `ui`, `types`, `export`, `import`, `exif`, `docs`, `build`.

## The invariant, restated

`computeLayout` returns cells whose `w / h` equals the photo's `ratio`, always. The engine only scales down to fit, never up, never non-proportionally, never clips. Any diff that could break this is rejected. `src/lib/layout.test.ts` is the guard — keep it passing and extend it whenever the engine changes.
