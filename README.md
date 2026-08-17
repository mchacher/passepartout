# Passepartout

A local-first photo album layout tool that **never crops your photos**.

Import a set of photos, then decide page by page how many go on each page, which ones, and which layout (rows and grids). The layout engine places each photo inside its region and keeps its original aspect ratio, surrounded by whitespace. There is no crop tool, by design: your framing is respected exactly.

> A _passe-partout_ is the white mat around a framed photo. This app makes that whitespace the point.

## Why

Most album software starts from fixed template slots and forces each photo to fill its slot, which crops it. Passepartout inverts that: you pick a layout, but each photo is only ever *contained* inside its region (fit and centered), never stretched to fill it. The only things the engine controls are size and whitespace.

## Features

- **Per-page control**: choose 1 to 4 photos per page and exactly which photos, by drag and drop.
- **Layouts**: pick an explicit arrangement per page (rows and grids); whitespace only scales the photos inside it, it never re-groups them.
- **No cropping, ever**: aspect ratios are preserved to the pixel; a portrait stays portrait, a panorama stays panorama.
- **Assumed whitespace**: eight whitespace levels per page tune how much white surrounds the photos, from a full-region fill to airy.
- **Free text**: a title per page and a caption under each photo.
- **Chronological by default**: photos order themselves by EXIF capture time (falling back to file date).
- **Formats**: square, landscape, portrait.
- **Local and private**: everything runs in your browser. Photos never leave your machine.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:5180 and click **Load an example** to see the engine immediately, or **Import photos** to use your own.

## Scripts

| Command            | What it does                          |
| ------------------ | ------------------------------------- |
| `npm run dev`      | Vite dev server                       |
| `npm run build`    | Type-check and build static site      |
| `npm run preview`  | Serve the production build locally    |
| `npm run test`     | Run the layout engine tests (Vitest)  |
| `npm run validate` | Type-check + lint + test              |

## Status

Early prototype. The layout engine, per-page editing, titles and captions work. Print-ready PDF export and printer presets are on the roadmap (see `CLAUDE.md`).

## License

Private, personal project.
