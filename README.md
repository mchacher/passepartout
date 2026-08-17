# Passepartout

A local-first photo album layout tool that **never crops your photos**.

Import a set of photos, then decide page by page how many go on each page and which ones. The layout engine arranges them into airy, centered rows that keep every photo's original aspect ratio. There is no crop tool, by design: your framing is respected exactly.

> A _passe-partout_ is the white mat around a framed photo. This app makes that whitespace the point.

## Why

Most album software starts from fixed template slots and forces each photo to fill its slot, which crops it. Passepartout inverts that: the layout adapts to the photos, never the other way around. The only things the engine controls are size and whitespace.

## Features

- **Per-page control**: choose 1 to 4 photos per page and exactly which photos, by drag and drop.
- **No cropping, ever**: aspect ratios are preserved to the pixel; a portrait stays portrait, a panorama stays panorama.
- **Assumed whitespace**: a density slider tunes how much white surrounds the photos.
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
