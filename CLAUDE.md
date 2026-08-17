# CLAUDE.md

Guidance for Claude Code (and any AI agent) working on **Passepartout**. First file to read when starting a session.

## Project in one paragraph

Passepartout is a **local-first photo album layout tool that never crops your photos**. You import a set of photos (a holiday, a trip), and page by page you decide how many photos go on the page and which ones. A layout engine arranges them into centered rows that keep each photo's native aspect ratio and surround it with generous whitespace ("blancs assumes"). The only degrees of freedom are size and gap: there is deliberately **no crop tool**, so a photo is never clipped or distorted. Everything runs in the browser, photos never leave the machine, and the app builds to static files. The end goal is a print-ready export (300 DPI + bleed) for services like CEWE / Blurb / Saal Digital.

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
│   ├── store.ts            # Zustand album store (all mutations live here)
│   ├── lib/
│   │   ├── layout.ts       # PURE layout engine (the heart) + its invariants
│   │   ├── layout.test.ts  # Ratio-preservation + fit tests
│   │   ├── exif.ts         # Best-effort EXIF DateTimeOriginal reader
│   │   └── demo.ts         # Canvas-generated sample photos
│   └── components/
│       ├── TopBar.tsx      # Import, format, whitespace, auto-arrange
│       ├── Library.tsx     # Photo tray (drag source + drop-to-remove)
│       ├── PageCard.tsx    # Per-page header: title, count 1-4, delete
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
5. **Persistence** of a project (save/reopen) via the File System Access API or a downloadable project file.

## When in doubt

If a change could crop, clip, or non-proportionally resize a photo, it is wrong by definition. Everything else is negotiable.
