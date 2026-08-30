# Release notes

Newest first. Each release has a `## vX.Y.Z` section; adding one is required before a tag can
be published (the release workflow refuses to publish without it - spec 028).

## v0.11.1 - 2026-08-30

Blank pages you did not ask for.

- **An inside cover you left empty is no longer printed**: the first and the last sheet of the
  book are the faces you see on opening and closing the cover. The export printed them whether
  or not you had put anything on them, so an album that never touched them arrived at the
  printer with a blank page at each end, and paid for them. A face carrying a photo, a title or
  a note still prints, as content. A face with nothing on it at all is now left out. An album of
  23 pages that used to export as 26, with three empty pages, now exports as 24 with a single
  blank sheet, the one the printer requires to reach an even count.
- **A short album is padded to the printer's minimum**: Blurb binds nothing under 20 pages. The
  export rounded the page count up to an even number but ignored that floor, so a twelve page
  album produced a file the printer refuses. The panel had been warning about it in red for a
  while; now the file itself is right.

## v0.11.0 - 2026-08-30

Albums that the printer accepts.

- **Blurb accepts the exported PDFs**: every file the app produced was rejected by Blurb's
  preflight, on all three counts it checks. The book sizes were built on Blurb's catalogue
  names, which are rounded: what it calls a 10x8 landscape is really cut at 9.5 x 8.0 inches,
  and only the 8x10 portrait was the size its name claimed. The bleed, the margin of image that
  runs past the cut, was added all the way round a page when Blurb only trims the top, the
  bottom and the outer edge, never the fold. And the cover was laid out as two pages plus a
  spine, which describes no cover Blurb actually binds: an ImageWrap hardcover is larger than
  the pages it closes on, a dust jacket carries two flaps, a soft cover finishes flush. All
  three are now taken from Blurb's own specification tool rather than worked out from the
  catalogue name.
- **The page you see is the page that prints**: correcting the sizes also corrects the shape of
  the page in the editor, which had been slightly too wide in landscape and not quite square in
  the small square format. Existing albums keep their photos and their layouts, and re-flow into
  the true page. No photo is cropped, as ever.
- **An even number of pages, ending where you meant it to**: Blurb only binds books with an even
  page count, and pads odd ones itself by adding a sheet after the inside back cover, which
  pushes the end of the book past its last page. The export now adds that blank sheet before the
  inside back cover instead, so the book closes the way you arranged it.
- **The export panel tells you what the printer expects**: pick the cover you are ordering, soft
  cover, dust jacket or ImageWrap, and the panel shows the exact dimensions Blurb will demand of
  both files, next to the page count it will actually print. A mismatch is now visible before an
  upload rather than after one.

## v0.10.1 - 2026-08-29

A self-hosted instance served over plain HTTP could not add a page.

- **Pages, notes and photos can be added again on a plain-HTTP instance**: `crypto.randomUUID`,
  which the app used to mint every id, only exists in a secure context, meaning HTTPS or
  `http://localhost`. An instance reached at a LAN address such as `http://192.168.1.10`, which
  is the setup described in the self-hosting guide, is not one, so inserting a page threw and
  quietly did nothing. Nothing showed up in the server logs either, since the request was never
  sent. Ids now come from a helper that falls back to `crypto.getRandomValues` when
  `crypto.randomUUID` is missing, so the app behaves the same whichever way it is served.

## v0.10.0 - 2026-08-25

Words on the page, and fonts that survive the trip to the printer.

- **Notes on the page**: drop a small block of text anywhere on a page or a cover face, in the
  whitespace or right over a photo. Drag it where you want it, pull a handle to decide where
  the text wraps, tilt it, and type on the paper itself. Six typefaces, regular, italic or
  bold, five sizes, the album's own inks or a colour of your choosing, and four typographic
  treatments: spaced small caps, a hairline rule, an opacity step, and a paper reserve that
  keeps a note legible over a busy image. A note is laid on top of the finished page: it never
  moves, resizes or crops a single photo.
- **The font you pick is the font that prints**: until now the exported PDF could not carry
  your album's font and quietly replaced it with Times, Helvetica or Courier, so three of the
  five styles came out of the printer identical and a title could wrap on paper where it did
  not on screen. Every style is now set in a typeface that ships with the app and travels
  inside the PDF. Two styles join the five, which keep their names and gain a real typeface:
  Serif is EB Garamond, Sans is Lato, Humanist is Cabin, Rounded is Quicksand, Typewriter is
  Courier Prime, and the new Display and Handwritten are Playfair Display and Caveat. Your
  albums keep the style you chose; only the typeface it is set in changes. The style menu now
  names the typeface, and your titles can use the characters those faces carry, well beyond
  what the old export allowed.
- **A cover photo can be removed again**: on a cover face, the small cross that clears the
  photo sat underneath the editable title and disappeared the moment the pointer went for it,
  so a photo that filled the face could not be removed at all. It now sits in the corner of
  the photo and stays put.

## v0.9.0 - 2026-08-23

Arranging a page is now a click away, and a batch of fixes to what you look at all day.

- **Click a photo to arrange the page**: the "Arrange" button is gone. Click any photo on a
  page whose slots are all filled and free placement opens on that photo, ready to move and
  resize. Escape, a click outside the page, or Done leaves it. A page that still has an empty
  slot ignores the click, and dragging a photo onto another slot still swaps the two.
- **Library thumbnails stop overlapping**: with a large library the rows of the photo tray were
  shorter than the square thumbnails they held, so every row overlapped the one above, and the
  more photos you imported the worse it looked. Rows now take the height of their thumbnails at
  all three densities.
- **A multi-selection you can actually see**: in Edit layout, selected photos wore three
  different outlines and even an unselected photo carried a faint version of the same colour.
  Every selected photo now wears the very same outline, an unselected one a neutral outline, and
  the photo that carries the resize handles is the one the single-photo controls act on.
- **The wordmark reads Passe-partout**: it showed a middle dot instead of the hyphen the word
  is spelled with.
- **Honest wording about cropping**: the welcome screen claimed there was no crop tool. There is
  one, and there is also full-page Fill and masks. The app now says what it actually does: it
  keeps your photos' original framing and never crops on its own, cropping is your call, photo
  by photo.

## v0.8.0 - 2026-08-23

Library and page work, a faithful PDF, and a server that stays responsive.

- **Add a page anywhere**: the "Add page" button now sits in every gap of the album, before the
  first page, between each pair and after the last one. It replaces the hover-only "Insert a
  page here" bar from v0.7.0, which was hard to find and looked nothing like the button at the
  end of the list.
- **No duplicate imports**: importing a folder you already imported adds nothing. A photo is
  recognised by its file name, its dimensions and its capture date, and the Library tells you
  how many files it skipped. Selecting the same file twice in one import adds it once.
- **Delete a photo from the Library**: hover a thumbnail for a small cross. An unused photo goes
  straight away; one that is in use asks first and tells you how many places it will leave. The
  stored image is deleted too.
- **Your page arrangement survives**: dragging a photo from a page back to the Library used to
  throw away the whole custom grid you had arranged by hand. Now only that photo leaves and the
  freed cell becomes an empty drop target.
- **Page titles sit better**: the space a title and subtitle occupy is now worked out from the
  text itself, so the gap above your photos is the same at every text size, and the subtitle
  sits closer to its title. Pages with no text are unchanged.
- **What you see is what prints**: page and cover text used to be capped on screen at a
  readable pixel size, so titles looked smaller, relative to the page, than they came out in the
  PDF, and zooming quietly changed the composition. Text now renders at its true printed size
  everywhere. **Your titles will look bigger in the editor than before; the PDF is unchanged.**
- **Inside covers print as covers**: the second and third cover faces were exported as ordinary
  interior pages, with page text sizes rather than cover ones. They now print the way the editor
  and the book preview have always shown them.
- **The PDF keeps your typography**: characters the font can print were being stripped, so
  `coeur` written with its ligature came out as `cur`. The French ligature, curly quotes, en and
  em dashes, the ellipsis and the euro sign now survive into the exported book.

### Self-hosted server

- **Sign-in no longer freezes the instance**: verifying a password ran on the same thread that
  serves every request, so the server answered nothing for about 70 ms per sign-in. Hashing
  moved to scrypt, which runs off that thread. A request arriving during a sign-in is answered
  in about 1 ms instead of 40. Sign-in itself takes the same time as before.
  **Existing accounts keep their password**: their stored hash is upgraded quietly on their next
  sign-in, which costs that one sign-in about 70 ms extra.
- **The password endpoints are rate limited**: ten attempts per minute per client on sign-in,
  first-run setup and password change, with a much higher budget for the rest of the API.
  Serving photos is never throttled. If you run the api service with no reverse proxy in front,
  set `TRUST_PROXY=off` so the limit counts per connection instead of per forwarded header.

## v0.7.0 - 2026-08-22

- **Manual photo placement**: photos no longer fill pages automatically. Each page has a slot count
  you choose, and you drag photos from the Library into the slots you want; unfilled slots show as
  drop targets. New albums now start from your own photos (the built-in sample album was removed).
- **Insert a page anywhere**: you can add a fresh blank page before or after any existing page, not
  only at the end. Hover the gap above a page to reveal an "Insert a page here" button; the "Add
  page" button still appends at the end. (Superseded in v0.8.0: the hover bar was replaced by an
  "Add page" button in every gap.)
- **Swap two photos by dragging**: on a page that holds several photos, drag one photo onto another
  to swap their positions. Dropping a photo from the Library still fills the next empty slot.
- **Style several photos at once**: while arranging a page, Ctrl-click (or Cmd-click) to select
  multiple photos, then apply the same mask or frame to all of them in a single click.
- **Mask and frame on covers**: cover photos now support the same decorative masks and frames as
  page photos, set from new controls in the cover header and shown in the book preview.

## v0.6.0 - 2026-08-22

- **Borders follow the mask shape**: a framed photo that also has a mask now shows the border as a
  shaped ring around the shaped photo. A circle-masked photo gets a circular mat ring instead of a
  rectangular mat around a round photo; an oval mask gives an oval ring, an arch mask an arch, and
  so on.
- **Simpler rounded mask**: the three separate rounded-corner masks are replaced by a single
  "Rounded" mask with a size sub-control (subtle, normal, strong), like a frame's border width. The
  corner radius is now constant and perfectly circular, so it no longer stretches on a wide or tall
  photo.
- **Under the hood**: the app and the server now run on Node 22, with a refreshed toolchain (Vite 8,
  Vitest 4, ESLint 10, Zustand 5) and updated server libraries. Your albums are unchanged; this
  keeps Passepartout on current, supported dependencies. Self-hosters get the new images on the next
  `docker compose pull`.

## v0.5.0 - 2026-08-22

- **English or French interface**: the whole UI is now available in French as well as English,
  switched from an EN / FR toggle in the top bar (and on the sign-in screens), and defaulting to
  your browser's language. Your album content stays exactly as you typed it; only the interface
  is translated.
- **True circle mask**: alongside the oval, there is now a real circle mask that stays perfectly
  round whatever the photo's shape.
- **Rounded-corner sizes**: the rounded mask now comes in three strengths (subtle, normal,
  strong) instead of one that was too heavy.

## v0.4.1 - 2026-08-21

- Maintenance release, no functional change. Used to exercise the non-interruptible update flow
  from v0.4.0 end to end.

## v0.4.0 - 2026-08-21

- **Non-interruptible updates**: once a one-click update starts, a locked "Updating..." screen
  takes over and stays until the new version is live. It cannot be dismissed or re-triggered and
  survives a page refresh, so the update can no longer be interrupted mid-swap. If it takes too
  long, a safety timeout offers a manual reload.
- Fix: a genuine update failure now shows the real reason reported by the server instead of a
  generic message, and a stuck server-side update flag clears itself after a few minutes.

## v0.3.0 — 2026-08-21

- **Library density**: pick 2, 3 or 4 columns for the photo thumbnails, so a large library is
  easy to scan (more, smaller thumbnails) or to inspect (fewer, larger). The choice is
  remembered. Works whatever the capture dates.
- Fix: the app no longer mistakes a static host for a server (the `/api/health` probe now
  checks the response body), so `npm run dev` / a static-only deploy stays in local mode.

## v0.2.0 — 2026-08-21

First self-hostable release.

- **Self-hosting with Docker**: run Passepartout on your own server with `docker compose up -d`,
  behind your reverse proxy. See [self-hosting.md](self-hosting.md).
- **Server-backed data (optional)**: with the `api` service, albums and photos live on the
  server and are shared across devices; without it, Passepartout stays local-first (data in the
  browser).
- **User accounts**: a first-run setup creates the first account; everyone then signs in with
  their own username and password (all accounts equal). Manage accounts from the Admin menu.
- **In-app updates**: a server instance shows its version and can check for and apply a new
  release - one click when the Docker socket is mounted, otherwise the manual command.
- **Backup and transfer**: export a whole album as a `.zip` bundle and import it into another
  instance.
- The studio itself: no-crop layouts, opt-in crop / mask / frame / tilt decorations, a book
  preview with a flat cover wrap, and print-ready Blurb PDF export.
