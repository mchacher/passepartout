# Passepartout

A local-first photo album layout tool that **never crops your photos**.

Import a set of photos, then decide page by page how many go on each page, which ones, and which layout (rows and grids). The layout engine places each photo inside its region and keeps its original aspect ratio, surrounded by whitespace. There is no crop tool, by design: your framing is respected exactly.

> A _passe-partout_ is the white mat around a framed photo. This app makes that whitespace the point.

## Why

Most album software starts from fixed template slots and forces each photo to fill its slot, which crops it. Passepartout inverts that: you pick a layout, but each photo is only ever *contained* inside its region (fit and centered), never stretched to fill it. The only things the engine controls are size and whitespace.

## Features

- **Per-page control**: choose 1 to 6 photos per page and exactly which photos, by drag and drop.
- **Layouts**: pick an explicit arrangement per page (rows and grids); whitespace only scales the photos inside it, it never re-groups them.
- **No cropping by default**: a photo is shown whole and contained; a portrait stays portrait, a panorama stays panorama. Cropping is always an explicit choice, never automatic.
- **Crop when you want**: in Edit layout, a Crop button opens a free crop rectangle on the photo; the kept region then lays out and prints like any photo. The rest of your photos stay uncropped.
- **Full-page photos**: give a single-photo page the big-photo look. Fit fills the page with no crop (paper bands where the ratio differs); Fill covers the whole page by cropping, and you drag the photo to choose the framing. No-crop stays the default.
- **Assumed whitespace**: eight whitespace levels per page tune how much white surrounds the photos, from a full-region fill to airy.
- **Projects that persist**: your work is saved locally in the browser and survives a refresh; keep several named albums and switch between them (new, rename, duplicate, delete).
- **Backup and transfer**: export a whole album as a single self-contained bundle file (a `.zip` with the project and every photo at full resolution), then import it to back it up or move it to another Passepartout instance. Import always creates a new, independent project.
- **Complete booklet covers**: a front cover, its inside, the pages, the inside back, and the back cover, each with a title, a subtitle, and an optional photo (contained, never cropped).
- **Free text**: a title per page and a caption under each photo.
- **Chronological by default**: photos order themselves by EXIF capture time (falling back to file date).
- **Book sizes**: pick a real Blurb print size (Small/Large Square, Portrait 8x10, Landscape 10x8, Large Landscape); the page adopts that exact ratio so the preview matches the printed book.
- **Spine**: the bound edge repeats your cover title (or an override), previewed vertically, ready for the cover wrap at export.
- **Print-ready PDF export (Blurb)**: download a cover-wrap PDF (back + spine + front) and an interior PDF, at 300 DPI in sRGB with bleed. Photos are embedded at full resolution and never cropped; text is vector. Upload both to Blurb PDF to Book.
- **Album style**: give a project its own look with a font and a color palette (paper and text), from a small curated set. The accent color carries into the app so the album and the app read as one.
- **Text size**: set the size of each kind of text (cover title and subtitle, page title and subtitle, caption) with four levels (S/M/L/XL), from one common Style menu. Every page can carry its own title and subtitle.
- **Reorder pages**: a page navigator rail on the right shows a thumbnail of every page; drag the content pages to reorder them (the four cover faces stay fixed), or click a thumbnail to jump to that page.
- **Book preview**: read the whole album end to end in double-page spreads, as it will print, with a thumbnail rail to jump anywhere. Read-only, and every photo stays contained (never cropped).
- **Arrange freely on a grid**: layouts rest on a 12 x 12 page grid; an "Edit layout" mode lets you move and resize any photo on the grid, overlap photos and choose their front-to-back order. Photos are always contained, never cropped.
- **Zoom the pages**: a slider in the bottom-right corner enlarges the central page cards for easier editing, while the Library and the thumbnail rail keep their size. It only scales the display, so photos stay contained and are never cropped.
- **Reuse a photo**: a photo can appear on any number of pages at once, not consumed by one. The Library badges each photo with how many times it is used (across pages and covers) and offers an "Unused only" filter to find the photos you have not placed yet.
- **Decorative masks**: in Edit layout, give a photo a shape (oval, rounded, arch, ...) from an enrichable catalog. The mask follows the photo's box and only hides the pixels outside the shape, so the photo keeps its aspect ratio and size. Opt-in and per-photo; no mask is the default.
- **Decorative frames**: mat a photo in a colored border (whole, never clipped, with a selectable width) or a Polaroid (a square window you can pan with Shift-drag, over a bottom band) from an enrichable color palette, and add a handwritten note on the Polaroid in a real handwriting font, on screen and in the exported PDF.
- **Decorative tilt**: rotate a photo a few degrees in fixed steps for a scrapbook look. It is a whole-photo tilt (never crops or distorts) and composes with the crop, mask and frame (the whole unit tilts, note included), on screen and in print.
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
