// Internationalization core (spec 032). Dependency-free: a flat message catalog per language plus
// a `translate` lookup with `{name}` interpolation and a `plural` helper. English is the authored
// source and the fallback; French is the first translation. This module is PURE (no DOM, no React,
// no store) so it is unit-testable; the active language lives in `viewStore` and reaches components
// through the `useT` hook.
//
// Keys are namespaced by area (`topbar.*`, `page.*`, `err.*`, ...). Catalog display names are keyed
// by their catalog id (`layout.<id>`, `font.<id>`, ...); a test asserts the English values match
// the pure `src/lib/*` catalogs (no drift) and that every id has a French entry.
//
// Album CONTENT (titles, captions, the project name) is never translated: only interface chrome
// passes through here.

export type Lang = "en" | "fr";
export const LANGS: readonly Lang[] = ["en", "fr"];
export const DEFAULT_LANG: Lang = "en";

/** Pick a language from a browser locale string. `fr*` -> French, everything else -> English. */
export function detectLang(navigatorLang?: string | null): Lang {
  return (navigatorLang ?? "").toLowerCase().startsWith("fr") ? "fr" : "en";
}

export type Params = Record<string, string | number>;

// Replace {name} tokens with params; an absent param leaves the token untouched (never throws).
function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}

/** Look up a key in `lang`, falling back to English, then to the raw key. Interpolates params. */
export function translate(lang: Lang, key: string, params?: Params): string {
  const table = messages[lang] ?? messages.en;
  const raw = table[key] ?? messages.en[key] ?? key;
  return interpolate(raw, params);
}

export interface PluralForms {
  one: string;
  other: string;
}

/**
 * Pick a plural form by count and language and interpolate `{n}` (plus any extra params).
 * English: 1 -> one, else other. French: 0 and 1 -> one, else other.
 */
export function plural(lang: Lang, count: number, forms: PluralForms, params?: Params): string {
  const isOne = lang === "fr" ? Math.abs(count) <= 1 : Math.abs(count) === 1;
  const form = isOne ? forms.one : forms.other;
  return interpolate(form, { n: count, ...params });
}

// --- The catalog ---------------------------------------------------------------------------------
// One flat map per language. Kept in sync by the parity test in i18n.test.ts (every English key has
// a French key and vice versa) and the catalog-drift test (English catalog names equal the lib
// labels). Add a key to BOTH maps when you translate a new string.

const en: Record<string, string> = {
  // App shell / empty state
  "app.loading": "Loading your projects...",
  "app.noLocalSave": "This browser cannot save projects locally, so your work will be lost when you close the tab.",
  "app.empty.title": "Your photos, never cropped.",
  "app.empty.body":
    "Choose, page by page, how many photos to place and which ones. The engine arranges them in whitespace, keeping their original framing. There is no crop tool: that is the whole point.",
  "app.empty.import": "Import photos",
  "app.addPage": "Add page",
  "app.insertPage": "Insert a page here",

  // Top bar
  "topbar.tagline": "layout without cropping",
  "topbar.import": "Import",
  "topbar.preview": "Preview",
  "topbar.update": "Update",
  "topbar.showGrid": "Show the page grid",
  "topbar.hideGrid": "Hide the page grid",
  "topbar.previewReady": "Read through the whole book",
  "topbar.previewNoPhotos": "Import photos to preview the book",
  "topbar.updateAvailable": "Version {version} is available",

  // Project menu
  "project.none": "No project",
  "project.title": "Projects",
  "project.closeMenu": "Close projects menu",
  "project.import": "Import",
  "project.importTitle": "Import an album bundle (.zip) as a new project",
  "project.new": "New",
  "project.empty": "No projects yet.",
  "project.save": "Save",
  "project.rename": "Rename",
  "project.duplicate": "Duplicate",
  "project.export": "Export",
  "project.delete": "Delete",
  "project.confirmDelete": 'Delete project "{name}"? This cannot be undone.',
  "project.noSave": "Saving is unavailable in this browser; projects live only until you close the tab.",

  // Language selector
  "lang.label": "Language",
  "lang.en": "English",
  "lang.fr": "Français",

  // Empty-caption hint rendered by CSS (via a variable the language effect sets)
  "page.captionPlaceholder": "Add a caption",

  // Page card (controls + edit-layout toolbar)
  "page.titlePlaceholder": "Page title (optional)",
  "page.subtitlePlaceholder": "Subtitle (optional)",
  "page.photos": "Photos",
  "page.emptySlot": "Drag a photo here",
  "page.delete": "Delete page",
  "page.arrange": "Arrange",
  "page.arrangeStart": "Move and resize photos on the grid",
  "page.done": "Done",
  "page.arrangeDone": "Finish arranging",
  "page.crop": "Crop",
  "page.cropTitle": "Crop the photo",
  "page.mask": "Mask",
  "page.maskTitle": "Give the photo a decorative shape",
  "page.maskClose": "Close mask picker",
  "page.maskNoneTitle": "No mask (rectangle)",
  "page.none": "None",
  "page.frame": "Frame",
  "page.frameTitle": "Frame the photo (Polaroid, colored border)",
  "page.frameNoneTitle": "No frame",
  "page.frameNote": "Handwritten note",
  "page.frameShiftHint": "Shift-drag the photo to reposition it in the frame.",
  "page.tilt": "Tilt",
  "page.tiltTitle": "Tilt the photo (decorative)",
  "page.tiltClose": "Close tilt picker",
  "page.tiltLeft": "Tilt left {n} degrees",
  "page.tiltRight": "Tilt right {n} degrees",
  "page.straighten": "Straighten",
  "page.straightenTitle": "Straighten (reset to 0 degrees)",
  "page.front": "Front",
  "page.frontTitle": "Bring to front",
  "page.back": "Back",
  "page.backTitle": "Send to back",
  "page.remove": "Remove",
  "page.removeTitle": "Remove from page",
  "page.arrangeHint": "Drag to move, corners to resize.",
  "page.selectHint": "Click a photo to edit it. Ctrl-click to select several.",
  "page.selectedCount": "{n} selected",
  "page.layout": "Layout",
  "page.pageFill": "Page fill",
  "page.fill.off": "Off",
  "page.fill.offTitle": "Normal page",
  "page.fill.fit": "Fit",
  "page.fill.fitTitle": "Fill the page, never cropping",
  "page.fill.fill": "Fill",
  "page.fill.fillTitle": "Fill the page, cropping to fit",
  "page.fillCoverHint": "drag the photo to reposition the crop",
  "page.whitespace": "Whitespace",
  "page.whitespaceTitle": "Whitespace level {n} of {total}",

  // Cover faces (label + title/subtitle placeholders, keyed by face id)
  "cover.front.label": "Front cover",
  "cover.front.title": "Album title",
  "cover.front.subtitle": "Subtitle or date",
  "cover.insideFront.label": "Inside front cover",
  "cover.insideFront.title": "Note or dedication (optional)",
  "cover.insideFront.subtitle": "Optional",
  "cover.insideBack.label": "Inside back cover",
  "cover.insideBack.title": "Note (optional)",
  "cover.insideBack.subtitle": "Optional",
  "cover.back.label": "Back cover",
  "cover.back.title": "Closing note",
  "cover.back.subtitle": "Optional",
  "cover.dragHint": "Drag a photo here, or leave it text-only.",
  "cover.dropHint": "Drag a photo here (optional)",
  "cover.removePhoto": "Remove cover photo",

  // Crop editor
  "crop.title": "Crop photo",
  "crop.hint": "Drag the corners or edges; drag inside to move.",
  "crop.reset": "Reset",
  "crop.cancel": "Cancel",
  "crop.done": "Done",

  // Spine editor
  "spine.title": "Spine",
  "spine.placeholder": "Spine title (defaults to the cover title or album name)",
  "spine.usingCover": "using cover title",
  "spine.usingAlbum": "using album name",
  "spine.edge": "the bound edge of the book",
  "spine.previewTitle": "Spine preview",
  "spine.noTitle": "No title",

  // Page rail
  "rail.pages": "Pages",
  "rail.front": "Front",
  "rail.insideFront": "Inside front",
  "rail.insideBack": "Inside back",
  "rail.back": "Back",
  "rail.page": "Page {n}",
  "rail.scrollTo": "Scroll to this page",

  // Zoom control
  "zoom.label": "Zoom the pages",
  "zoom.fit": "Fit",
  "zoom.fitTitle": "Fit the pages to the available width",

  // Library
  "library.title": "Library",
  "library.unusedCount": "{unused} unused / {total}",
  "library.chronoHint": "Chronological order (capture date). Drag a photo onto a page.",
  "library.unusedOnly": "Unused only",
  "library.unusedOnlyTitle": "Show only photos not used anywhere yet",
  "library.thumbnailSize": "Thumbnail size",
  "library.columns": "{n} columns",
  "library.empty": "No photos imported.",
  "library.allUsed": "Every photo is used. Uncheck the filter to see them all.",
  "library.usedOne": "Used {n} time",
  "library.usedOther": "Used {n} times",

  // Theme (album style) menu
  "theme.albumStyle": "Album style",
  "theme.style": "Style",
  "theme.closeMenu": "Close style menu",
  "theme.font": "Font",
  "theme.palette": "Palette",
  "theme.textSize": "Text size",

  // Size menu
  "size.menuTitle": "Book size",
  "size.closeMenu": "Close size menu",
  "size.blurbHeading": "Book size (Blurb)",

  // Export panel
  "export.export": "Export",
  "export.buttonTitle": "Export a print-ready PDF for Blurb",
  "export.closePanel": "Close export panel",
  "export.heading": "Export for Blurb",
  "export.bookSize": "Book size",
  "export.interiorPages": "Interior pages",
  "export.paper": "Paper",
  "export.spineMm": "Spine (mm)",
  "export.spineHint": "Estimated from the page count, paper and cover. Paste Blurb's exact spine width from its spec tool to override.",
  "export.onSpine": "On the spine",
  "export.spineTitle": "Title",
  "export.spineTitleSubtitle": "Title + subtitle",
  "export.building": "Building...",
  "export.coverWrap": "Cover wrap",
  "export.interior": "Interior",
  "export.footer": "300 DPI, sRGB, 0.32 cm bleed. Upload both files to Blurb PDF to Book (cover and pages).",

  // Book preview
  "preview.title": "Book preview",
  "preview.cover": "Cover",
  "preview.close": "Close preview (Esc)",
  "preview.closeBackdrop": "Close preview",
  "preview.prev": "Previous spread",
  "preview.next": "Next spread",
  "preview.goCoverWrap": "Go to the cover wrap",
  "preview.goTo": "Go to {label}",

  // Errors: import + bundle (keyed by store/bundle code)
  "err.import.no-save": "Saving is unavailable in this browser, so importing is disabled.",
  "err.import.read-failed": "Could not read this file.",
  "err.import.save-failed": "Could not save the imported album.",
  "err.bundle.not-zip": "This file is not a valid zip archive.",
  "err.bundle.missing-manifest": "This is not a Passepartout album bundle (missing album.json).",
  "err.bundle.corrupt-manifest": "The album bundle manifest is corrupt.",
  "err.bundle.not-bundle": "This is not a Passepartout album bundle.",
  "err.bundle.newer-version": "This bundle was created by a newer version of Passepartout.",
  "err.bundle.no-project": "This album bundle has no project.",
  "err.generic": "Something went wrong.",

  // Auth: setup + login (the "Passe·partout" brand is not translated)
  "auth.setup.title": "Welcome to Passe·partout",
  "auth.setup.subtitle": "Create the first account. You can add more later.",
  "auth.username": "Username",
  "auth.password": "Password",
  "auth.passwordMin": "Password (at least 8 characters)",
  "auth.confirmPassword": "Confirm password",
  "auth.creating": "Creating...",
  "auth.createAccount": "Create account",
  "auth.err.username": "Choose a username.",
  "auth.err.passwordMin": "Password must be at least 8 characters.",
  "auth.err.mismatch": "Passwords do not match.",
  "auth.err.createFailed": "Could not create the account.",
  "auth.login.subtitle": "Sign in to open your albums.",
  "auth.signingIn": "Signing in...",
  "auth.signIn": "Sign in",
  "auth.err.credentials": "Wrong username or password.",

  // Users panel
  "users.title": "Users",
  "users.close": "Close",
  "users.you": "(you)",
  "users.remove": "Remove",
  "users.addTitle": "Add a user",
  "users.add": "Add",
  "users.changePw": "Change your password",
  "users.current": "Current",
  "users.new": "New (8+)",
  "users.save": "Save",
  "users.pwChanged": "Password changed.",
  "users.err.addFailed": "Could not add the user.",
  "users.err.pwFailed": "Could not change the password.",
  "users.confirmDelete": 'Delete "{name}"?',

  // Admin menu
  "admin.title": "Account & instance",
  "admin.close": "Close menu",
  "admin.signedInAs": "Signed in as {user}",
  "admin.users": "Users",
  "admin.version": "Version",
  "admin.checking": "Checking...",
  "admin.checkUpdates": "Check for updates",
  "admin.upToDate": "Up to date.",
  "admin.noToken": "Update check unavailable (no GitHub token).",
  "admin.updateTo": "v{version} available, update",
  "admin.logout": "Log out",

  // Update sheet + non-interruptible overlay
  "update.available": "Update available",
  "update.body": "Pull the new version and restart the server. It takes a minute; the page reloads when it is back.",
  "update.later": "Later",
  "update.now": "Update now",
  "update.socketOff": "One-click update is off on this server (the Docker socket is not mounted). Update from the host:",
  "update.close": "Close",
  "update.err.start": "Could not start the update on the server.",
  "update.overlay.to": "Updating to {version}",
  "update.overlay.target": "the new version",
  "update.overlay.body": "Keep this tab open. The server is restarting and the app reloads on its own when the new version is live. This usually takes under a minute.",
  "update.overlay.slowTitle": "This is taking longer than expected",
  "update.overlay.slowBody": "The update to {version} has not come back yet. Reload to check, or dismiss and verify the server from the host.",
  "update.overlay.dismiss": "Dismiss",
  "update.overlay.reload": "Reload",

  // Catalog: layouts
  "layout.single": "Single",
  "layout.two-row": "Side by side",
  "layout.two-col": "Stacked",
  "layout.three-row": "Row of 3",
  "layout.three-col": "Column of 3",
  "layout.one-over-two": "1 over 2",
  "layout.two-over-one": "2 over 1",
  "layout.one-beside-two": "1 beside 2",
  "layout.four-row": "Row of 4",
  "layout.grid-2x2": "2 x 2 grid",
  "layout.one-over-three": "1 over 3",
  "layout.three-over-one": "3 over 1",
  "layout.one-beside-three": "1 beside 3",
  "layout.five-2-3": "2 over 3",
  "layout.five-3-2": "3 over 2",
  "layout.five-1-4": "1 over 4",
  "layout.five-row": "Row of 5",
  "layout.five-beside": "1 beside 4",
  "layout.six-3x2": "3 x 2 grid",
  "layout.six-2x3": "2 x 3 grid",
  "layout.six-2-4": "2 over 4",
  "layout.six-1-5": "1 over 5",
  "layout.six-beside": "1 beside 5",

  // Catalog: fonts
  "font.serif": "Serif",
  "font.sans": "Sans",
  "font.humanist": "Humanist",
  "font.rounded": "Rounded",
  "font.typewriter": "Typewriter",

  // Catalog: colors
  "color.classic": "Classic",
  "color.warm": "Warm",
  "color.slate": "Slate",
  "color.sage": "Sage",
  "color.ink": "Ink",

  // Catalog: book sizes
  "size.blurb-square-7": "Small Square 7x7",
  "size.blurb-square-12": "Large Square 12x12",
  "size.blurb-portrait-8x10": "Portrait 8x10",
  "size.blurb-landscape-10x8": "Landscape 10x8",
  "size.blurb-landscape-13x11": "Large Landscape 13x11",

  // Catalog: masks (circle + rounded sizes land with the mask-shapes PR; kept here so the two
  // PRs merge in any order without the catalog-drift test failing)
  "mask.circle": "Circle",
  "mask.oval": "Oval",
  "mask.rounded": "Rounded",
  "mask.arch": "Arch",
  // Rounded mask corner sizes (spec 034 sub-control)
  "roundedSize.sm": "Subtle",
  "roundedSize.md": "Medium",
  "roundedSize.lg": "Strong",

  // Catalog: frames + border widths + frame colors
  "frame.polaroid": "Polaroid",
  "frame.border": "Border",
  "borderWidth.thin": "Thin",
  "borderWidth.medium": "Medium",
  "borderWidth.thick": "Thick",
  "frameColor.white": "White",
  "frameColor.black": "Black",
  "frameColor.kraft": "Kraft",
  "frameColor.blush": "Blush",
  "frameColor.sage": "Sage",
  "frameColor.navy": "Navy",

  // Catalog: papers
  "paper.standard": "Standard",
  "paper.premium-lustre": "Premium Lustre",
  "paper.premium-matte": "Premium Matte",

  // Catalog: text roles
  "role.coverTitle": "Cover title",
  "role.coverSubtitle": "Cover subtitle",
  "role.pageTitle": "Page title",
  "role.pageSubtitle": "Page subtitle",
  "role.caption": "Caption",
};

const fr: Record<string, string> = {
  // App shell / empty state
  "app.loading": "Chargement de vos projets...",
  "app.noLocalSave": "Ce navigateur ne peut pas enregistrer les projets localement, votre travail sera perdu en fermant l'onglet.",
  "app.empty.title": "Vos photos, jamais recadrées.",
  "app.empty.body":
    "Choisissez, page par page, combien de photos placer et lesquelles. Le moteur les dispose dans des blancs, en préservant leur cadrage d'origine. Il n'y a pas d'outil de recadrage : c'est tout l'intérêt.",
  "app.empty.import": "Importer des photos",
  "app.addPage": "Ajouter une page",
  "app.insertPage": "Insérer une page ici",

  // Top bar
  "topbar.tagline": "mise en page sans recadrage",
  "topbar.import": "Importer",
  "topbar.preview": "Aperçu",
  "topbar.update": "Mettre à jour",
  "topbar.showGrid": "Afficher la grille de page",
  "topbar.hideGrid": "Masquer la grille de page",
  "topbar.previewReady": "Feuilleter tout le livre",
  "topbar.previewNoPhotos": "Importez des photos pour prévisualiser le livre",
  "topbar.updateAvailable": "La version {version} est disponible",

  // Project menu
  "project.none": "Aucun projet",
  "project.title": "Projets",
  "project.closeMenu": "Fermer le menu des projets",
  "project.import": "Importer",
  "project.importTitle": "Importer un paquet d'album (.zip) comme nouveau projet",
  "project.new": "Nouveau",
  "project.empty": "Aucun projet pour l'instant.",
  "project.save": "Enregistrer",
  "project.rename": "Renommer",
  "project.duplicate": "Dupliquer",
  "project.export": "Exporter",
  "project.delete": "Supprimer",
  "project.confirmDelete": 'Supprimer le projet "{name}" ? Cette action est irréversible.',
  "project.noSave": "L'enregistrement est indisponible dans ce navigateur ; les projets ne durent que jusqu'à la fermeture de l'onglet.",

  // Language selector
  "lang.label": "Langue",
  "lang.en": "English",
  "lang.fr": "Français",

  // Empty-caption hint rendered by CSS (via a variable the language effect sets)
  "page.captionPlaceholder": "Ajouter une légende",

  // Page card (controls + edit-layout toolbar)
  "page.titlePlaceholder": "Titre de la page (optionnel)",
  "page.subtitlePlaceholder": "Sous-titre (optionnel)",
  "page.photos": "Photos",
  "page.emptySlot": "Glissez une photo ici",
  "page.delete": "Supprimer la page",
  "page.arrange": "Disposer",
  "page.arrangeStart": "Déplacer et redimensionner les photos sur la grille",
  "page.done": "Terminé",
  "page.arrangeDone": "Terminer la disposition",
  "page.crop": "Recadrer",
  "page.cropTitle": "Recadrer la photo",
  "page.mask": "Masque",
  "page.maskTitle": "Donner une forme décorative à la photo",
  "page.maskClose": "Fermer le sélecteur de masque",
  "page.maskNoneTitle": "Aucun masque (rectangle)",
  "page.none": "Aucun",
  "page.frame": "Cadre",
  "page.frameTitle": "Encadrer la photo (Polaroid, bordure colorée)",
  "page.frameNoneTitle": "Aucun cadre",
  "page.frameNote": "Note manuscrite",
  "page.frameShiftHint": "Maj + glisser la photo pour la repositionner dans le cadre.",
  "page.tilt": "Incliner",
  "page.tiltTitle": "Incliner la photo (décoratif)",
  "page.tiltClose": "Fermer le sélecteur d'inclinaison",
  "page.tiltLeft": "Incliner à gauche de {n} degrés",
  "page.tiltRight": "Incliner à droite de {n} degrés",
  "page.straighten": "Redresser",
  "page.straightenTitle": "Redresser (remettre à 0 degré)",
  "page.front": "Avant",
  "page.frontTitle": "Mettre au premier plan",
  "page.back": "Arrière",
  "page.backTitle": "Mettre en arrière-plan",
  "page.remove": "Retirer",
  "page.removeTitle": "Retirer de la page",
  "page.arrangeHint": "Glisser pour déplacer, coins pour redimensionner.",
  "page.selectHint": "Cliquez une photo pour la modifier. Ctrl-clic pour en sélectionner plusieurs.",
  "page.selectedCount": "{n} sélectionnées",
  "page.layout": "Mise en page",
  "page.pageFill": "Remplissage de page",
  "page.fill.off": "Aucun",
  "page.fill.offTitle": "Page normale",
  "page.fill.fit": "Ajuster",
  "page.fill.fitTitle": "Remplir la page, sans recadrer",
  "page.fill.fill": "Remplir",
  "page.fill.fillTitle": "Remplir la page, en recadrant",
  "page.fillCoverHint": "glisser la photo pour repositionner le recadrage",
  "page.whitespace": "Blancs",
  "page.whitespaceTitle": "Niveau de blancs {n} sur {total}",

  // Cover faces (label + title/subtitle placeholders, keyed by face id)
  "cover.front.label": "Première de couverture",
  "cover.front.title": "Titre de l'album",
  "cover.front.subtitle": "Sous-titre ou date",
  "cover.insideFront.label": "Deuxième de couverture",
  "cover.insideFront.title": "Note ou dédicace (optionnel)",
  "cover.insideFront.subtitle": "Optionnel",
  "cover.insideBack.label": "Troisième de couverture",
  "cover.insideBack.title": "Note (optionnel)",
  "cover.insideBack.subtitle": "Optionnel",
  "cover.back.label": "Quatrième de couverture",
  "cover.back.title": "Note de fin",
  "cover.back.subtitle": "Optionnel",
  "cover.dragHint": "Glissez une photo ici, ou conservez uniquement le texte.",
  "cover.dropHint": "Glissez une photo ici (optionnel)",
  "cover.removePhoto": "Retirer la photo de couverture",

  // Crop editor
  "crop.title": "Recadrer la photo",
  "crop.hint": "Glissez les coins ou les bords ; glissez à l'intérieur pour déplacer.",
  "crop.reset": "Réinitialiser",
  "crop.cancel": "Annuler",
  "crop.done": "Terminé",

  // Spine editor
  "spine.title": "Dos",
  "spine.placeholder": "Titre du dos (par défaut le titre de couverture ou le nom de l'album)",
  "spine.usingCover": "d'après le titre de couverture",
  "spine.usingAlbum": "d'après le nom de l'album",
  "spine.edge": "le bord relié du livre",
  "spine.previewTitle": "Aperçu du dos",
  "spine.noTitle": "Sans titre",

  // Page rail
  "rail.pages": "Pages",
  "rail.front": "1re de couv.",
  "rail.insideFront": "2e de couv.",
  "rail.insideBack": "3e de couv.",
  "rail.back": "4e de couv.",
  "rail.page": "Page {n}",
  "rail.scrollTo": "Aller à cette page",

  // Zoom control
  "zoom.label": "Zoomer les pages",
  "zoom.fit": "Ajuster",
  "zoom.fitTitle": "Ajuster les pages à la largeur disponible",

  // Library
  "library.title": "Photothèque",
  "library.unusedCount": "{unused} inutilisées / {total}",
  "library.chronoHint": "Ordre chronologique (date de prise). Glissez une photo sur une page.",
  "library.unusedOnly": "Inutilisées seulement",
  "library.unusedOnlyTitle": "Afficher uniquement les photos pas encore utilisées",
  "library.thumbnailSize": "Taille des vignettes",
  "library.columns": "{n} colonnes",
  "library.empty": "Aucune photo importée.",
  "library.allUsed": "Toutes les photos sont utilisées. Décochez le filtre pour toutes les voir.",
  "library.usedOne": "Utilisée {n} fois",
  "library.usedOther": "Utilisée {n} fois",

  // Theme (album style) menu
  "theme.albumStyle": "Style de l'album",
  "theme.style": "Style",
  "theme.closeMenu": "Fermer le menu de style",
  "theme.font": "Police",
  "theme.palette": "Palette",
  "theme.textSize": "Taille du texte",

  // Size menu
  "size.menuTitle": "Taille du livre",
  "size.closeMenu": "Fermer le menu de taille",
  "size.blurbHeading": "Taille du livre (Blurb)",

  // Export panel
  "export.export": "Exporter",
  "export.buttonTitle": "Exporter un PDF prêt à imprimer pour Blurb",
  "export.closePanel": "Fermer le panneau d'export",
  "export.heading": "Exporter pour Blurb",
  "export.bookSize": "Taille du livre",
  "export.interiorPages": "Pages intérieures",
  "export.paper": "Papier",
  "export.spineMm": "Dos (mm)",
  "export.spineHint": "Estimé d'après le nombre de pages, le papier et la couverture. Collez la largeur exacte du dos depuis l'outil Blurb pour la remplacer.",
  "export.onSpine": "Sur le dos",
  "export.spineTitle": "Titre",
  "export.spineTitleSubtitle": "Titre + sous-titre",
  "export.building": "Génération...",
  "export.coverWrap": "Couverture complète",
  "export.interior": "Intérieur",
  "export.footer": "300 DPI, sRGB, fond perdu 0,32 cm. Envoyez les deux fichiers à Blurb PDF to Book (couverture et pages).",

  // Book preview
  "preview.title": "Aperçu du livre",
  "preview.cover": "Couverture",
  "preview.close": "Fermer l'aperçu (Échap)",
  "preview.closeBackdrop": "Fermer l'aperçu",
  "preview.prev": "Double page précédente",
  "preview.next": "Double page suivante",
  "preview.goCoverWrap": "Aller à la couverture complète",
  "preview.goTo": "Aller à {label}",

  // Errors: import + bundle (keyed by store/bundle code)
  "err.import.no-save": "L'enregistrement est indisponible dans ce navigateur, l'import est désactivé.",
  "err.import.read-failed": "Impossible de lire ce fichier.",
  "err.import.save-failed": "Impossible d'enregistrer l'album importé.",
  "err.bundle.not-zip": "Ce fichier n'est pas une archive zip valide.",
  "err.bundle.missing-manifest": "Ce n'est pas un paquet d'album Passepartout (album.json manquant).",
  "err.bundle.corrupt-manifest": "Le manifeste du paquet d'album est corrompu.",
  "err.bundle.not-bundle": "Ce n'est pas un paquet d'album Passepartout.",
  "err.bundle.newer-version": "Ce paquet a été créé par une version plus récente de Passepartout.",
  "err.bundle.no-project": "Ce paquet d'album ne contient aucun projet.",
  "err.generic": "Une erreur est survenue.",

  // Auth: setup + login (the "Passe·partout" brand is not translated)
  "auth.setup.title": "Bienvenue sur Passe·partout",
  "auth.setup.subtitle": "Créez le premier compte. Vous pourrez en ajouter d'autres plus tard.",
  "auth.username": "Nom d'utilisateur",
  "auth.password": "Mot de passe",
  "auth.passwordMin": "Mot de passe (au moins 8 caractères)",
  "auth.confirmPassword": "Confirmer le mot de passe",
  "auth.creating": "Création...",
  "auth.createAccount": "Créer le compte",
  "auth.err.username": "Choisissez un nom d'utilisateur.",
  "auth.err.passwordMin": "Le mot de passe doit comporter au moins 8 caractères.",
  "auth.err.mismatch": "Les mots de passe ne correspondent pas.",
  "auth.err.createFailed": "Impossible de créer le compte.",
  "auth.login.subtitle": "Connectez-vous pour ouvrir vos albums.",
  "auth.signingIn": "Connexion...",
  "auth.signIn": "Se connecter",
  "auth.err.credentials": "Nom d'utilisateur ou mot de passe incorrect.",

  // Users panel
  "users.title": "Utilisateurs",
  "users.close": "Fermer",
  "users.you": "(vous)",
  "users.remove": "Retirer",
  "users.addTitle": "Ajouter un utilisateur",
  "users.add": "Ajouter",
  "users.changePw": "Changer votre mot de passe",
  "users.current": "Actuel",
  "users.new": "Nouveau (8+)",
  "users.save": "Enregistrer",
  "users.pwChanged": "Mot de passe modifié.",
  "users.err.addFailed": "Impossible d'ajouter l'utilisateur.",
  "users.err.pwFailed": "Impossible de changer le mot de passe.",
  "users.confirmDelete": 'Supprimer "{name}" ?',

  // Admin menu
  "admin.title": "Compte et instance",
  "admin.close": "Fermer le menu",
  "admin.signedInAs": "Connecté en tant que {user}",
  "admin.users": "Utilisateurs",
  "admin.version": "Version",
  "admin.checking": "Vérification...",
  "admin.checkUpdates": "Rechercher des mises à jour",
  "admin.upToDate": "À jour.",
  "admin.noToken": "Vérification des mises à jour indisponible (pas de jeton GitHub).",
  "admin.updateTo": "v{version} disponible, mettre à jour",
  "admin.logout": "Se déconnecter",

  // Update sheet + non-interruptible overlay
  "update.available": "Mise à jour disponible",
  "update.body": "Récupérer la nouvelle version et redémarrer le serveur. Cela prend une minute ; la page se recharge une fois de retour.",
  "update.later": "Plus tard",
  "update.now": "Mettre à jour maintenant",
  "update.socketOff": "La mise à jour en un clic est désactivée sur ce serveur (le socket Docker n'est pas monté). Mettez à jour depuis l'hôte :",
  "update.close": "Fermer",
  "update.err.start": "Impossible de démarrer la mise à jour sur le serveur.",
  "update.overlay.to": "Mise à jour vers {version}",
  "update.overlay.target": "la nouvelle version",
  "update.overlay.body": "Gardez cet onglet ouvert. Le serveur redémarre et l'application se recharge d'elle-même une fois la nouvelle version en ligne. Cela prend généralement moins d'une minute.",
  "update.overlay.slowTitle": "Cela prend plus de temps que prévu",
  "update.overlay.slowBody": "La mise à jour vers {version} n'est pas encore revenue. Rechargez pour vérifier, ou fermez et vérifiez le serveur depuis l'hôte.",
  "update.overlay.dismiss": "Fermer",
  "update.overlay.reload": "Recharger",

  // Catalog: layouts
  "layout.single": "Unique",
  "layout.two-row": "Côte à côte",
  "layout.two-col": "Empilées",
  "layout.three-row": "Rangée de 3",
  "layout.three-col": "Colonne de 3",
  "layout.one-over-two": "1 sur 2",
  "layout.two-over-one": "2 sur 1",
  "layout.one-beside-two": "1 à côté de 2",
  "layout.four-row": "Rangée de 4",
  "layout.grid-2x2": "Grille 2 x 2",
  "layout.one-over-three": "1 sur 3",
  "layout.three-over-one": "3 sur 1",
  "layout.one-beside-three": "1 à côté de 3",
  "layout.five-2-3": "2 sur 3",
  "layout.five-3-2": "3 sur 2",
  "layout.five-1-4": "1 sur 4",
  "layout.five-row": "Rangée de 5",
  "layout.five-beside": "1 à côté de 4",
  "layout.six-3x2": "Grille 3 x 2",
  "layout.six-2x3": "Grille 2 x 3",
  "layout.six-2-4": "2 sur 4",
  "layout.six-1-5": "1 sur 5",
  "layout.six-beside": "1 à côté de 5",

  // Catalog: fonts
  "font.serif": "Serif",
  "font.sans": "Sans",
  "font.humanist": "Humaniste",
  "font.rounded": "Arrondie",
  "font.typewriter": "Machine à écrire",

  // Catalog: colors
  "color.classic": "Classique",
  "color.warm": "Chaude",
  "color.slate": "Ardoise",
  "color.sage": "Sauge",
  "color.ink": "Encre",

  // Catalog: book sizes
  "size.blurb-square-7": "Petit carré 7x7",
  "size.blurb-square-12": "Grand carré 12x12",
  "size.blurb-portrait-8x10": "Portrait 8x10",
  "size.blurb-landscape-10x8": "Paysage 10x8",
  "size.blurb-landscape-13x11": "Grand paysage 13x11",

  // Catalog: masks (circle + rounded sizes land with the mask-shapes PR; kept here so the two
  // PRs merge in any order without the catalog-drift test failing)
  "mask.circle": "Cercle",
  "mask.oval": "Ovale",
  "mask.rounded": "Arrondi",
  "mask.arch": "Arche",
  // Rounded mask corner sizes (spec 034 sub-control)
  "roundedSize.sm": "Léger",
  "roundedSize.md": "Moyen",
  "roundedSize.lg": "Fort",

  // Catalog: frames + border widths + frame colors
  "frame.polaroid": "Polaroid",
  "frame.border": "Bordure",
  "borderWidth.thin": "Fine",
  "borderWidth.medium": "Moyenne",
  "borderWidth.thick": "Épaisse",
  "frameColor.white": "Blanc",
  "frameColor.black": "Noir",
  "frameColor.kraft": "Kraft",
  "frameColor.blush": "Rose poudre",
  "frameColor.sage": "Sauge",
  "frameColor.navy": "Marine",

  // Catalog: papers
  "paper.standard": "Standard",
  "paper.premium-lustre": "Premium brillant",
  "paper.premium-matte": "Premium mat",

  // Catalog: text roles
  "role.coverTitle": "Titre de couverture",
  "role.coverSubtitle": "Sous-titre de couverture",
  "role.pageTitle": "Titre de page",
  "role.pageSubtitle": "Sous-titre de page",
  "role.caption": "Légende",
};

export const messages: Record<Lang, Record<string, string>> = { en, fr };
