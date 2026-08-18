# CLAUDE.md

Guidance for Claude Code (and any AI agent) working on **Passepartout**. First file to read when starting a session.

## Project in one paragraph

Passepartout is a **local-first photo album layout tool that never crops your photos**. You import a set of photos (a holiday, a trip), and page by page you decide how many photos go on the page, which ones, and which **layout** (an explicit arrangement: rows and grids). A layout engine places each photo inside a fixed region that keeps its native aspect ratio and surrounds it with generous whitespace ("blancs assumes"); a per-page whitespace level (1-8) only scales the photos inside that frozen layout, it never re-groups them. The only degrees of freedom are size and gap: there is deliberately **no crop tool**, so a photo is never clipped or distorted. Everything runs in the browser, photos never leave the machine, and the app builds to static files. The end goal is a print-ready export (300 DPI + bleed) for services like CEWE / Blurb / Saal Digital.

## Guiding principle

**The page is the unit of control; the photo's framing is sacred.** The engine may change a photo's size and the white around it, never its crop. Any feature that would resize non-proportionally or clip a photo is out of scope by definition.

## Tech stack

- React 18 + TypeScript (strict) + Vite
- Tailwind CSS (design tokens as CSS custom properties in `src/index.css`)
- Zustand for state (`src/store.ts`)
- Vitest for tests
- No backend. No network calls. Static build in `dist/`.

## Project structure

```
passepartout/
├── index.html
├── src/
│   ├── main.tsx            # Entry point
│   ├── App.tsx             # Shell: TopBar + Library + pages / empty state
│   ├── index.css           # Design tokens (both themes) + a few structural rules
│   ├── types.ts            # Photo, AlbumPage, PageFormat
│   ├── store.ts            # Zustand album store (all mutations here) + project auto-save
│   ├── persistence.ts      # IMPURE IndexedDB adapter (project docs + image blobs)
│   ├── lib/
│   │   ├── layout.ts       # PURE layout engine (the heart) + its invariants
│   │   ├── layout.test.ts  # Ratio-preservation + fit tests
│   │   ├── layouts.ts      # Layout template catalog (nested split trees) + helpers
│   │   ├── layouts.test.ts # Catalog invariants (leaf counts, defaults, auto)
│   │   ├── project.ts      # PURE project helpers (ProjectDoc, serialize/hydrate/duplicate)
│   │   ├── themes.ts       # PURE album-theme catalog (fonts + color palettes) + coercion
│   │   ├── theme-vars.ts   # PURE map: resolved theme + OS mode -> CSS custom properties
│   │   ├── text-sizes.ts   # PURE per-role text-size catalog + scale vars
│   │   ├── exif.ts         # Best-effort EXIF DateTimeOriginal reader
│   │   └── demo.ts         # Canvas-generated sample photos (with blobs)
│   ├── useApplyTheme.ts    # Hook: write the active theme's CSS vars onto <html>
│   └── components/
│       ├── TopBar.tsx      # Project switcher, style (theme), format, import
│       ├── ProjectMenu.tsx # Project switcher dropdown (new/open/rename/duplicate/delete)
│       ├── ThemeMenu.tsx   # Album style picker: font + color palette
│       ├── CoverCard.tsx   # Cover face (front/inside-front/inside-back/back): title + subtitle + optional photo
│       ├── Library.tsx     # Photo tray (drag source + drop-to-remove)
│       ├── PageCard.tsx    # Per-page header: title, count 1-6, layout picker, whitespace, delete
│       ├── LayoutThumb.tsx # Tiny SVG preview of a layout template
│       ├── Paper.tsx       # Measured page render (calls the engine)
│       └── dnd.ts          # Shared drag-and-drop payload key
└── docs/
    └── overview.md
```

## Build & run

```bash
npm install
npm run dev        # Vite dev server (http://localhost:5180)
npm run build      # tsc + vite build -> dist/
npm run preview    # serve the production build locally
npm run test       # vitest
npm run validate   # typecheck + lint + test
```

## Conventions (in the spirit of the Sowel repo)

- **Feature branches** for non-trivial work: `feat/`, `fix/`, `refactor/`, `docs/`. Conventional commits.
- **Never** add `Co-Authored-By: Claude` lines or any "Generated with Claude" mention in commits/PRs.
- **All written content in English** (code, docs, commits). Conversation may be French.
- **No em-dashes / en-dashes** in user-facing copy.
- **Always write tests** for new engine behavior. The layout engine must stay pure and covered.
- UUID v4 (`crypto.randomUUID()`) for ids. ISO / epoch-ms for time.
- Tailwind utility classes via semantic tokens (`bg-surface`, `text-ink`, `border-line`). Palette lives once in `src/index.css`; both light and dark themes are defined there.

## Roadmap (not built yet)

1. **PDF export** at print resolution (300 DPI) with bleed, reusing the same engine numbers to paint each page.
2. **Imprimeur presets** (CEWE / Blurb / Saal Digital page sizes + safe margins).
3. **Full-bleed / spread templates** (one photo across a double page) while still never cropping.
4. **Reorder pages**, drag to reorder photos within a page.
5. **Project files** export/import (backup, move machine, share). Local persistence and multi-project management already ship via IndexedDB (spec 002); this adds a portable file on top.

## Skills

Claude Code skills live under `.claude/skills/`:

| Skill                  | When to use                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| `passepartout-feature` | Implementing a feature. Phase 1-7 workflow with gates: spec, branch, implement, validate, verify in-app, review, integrate. |

## When in doubt

If a change could crop, clip, or non-proportionally resize a photo, it is wrong by definition. Everything else is negotiable.
