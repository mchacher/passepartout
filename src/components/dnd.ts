// Shared drag-and-drop payload keys. Photo drags carry a photo id; page drags carry a
// page id under a distinct MIME type so the two never cross-fire.
export const PHOTO_DND_TYPE = "text/plain";
export const PAGE_DND_TYPE = "application/x-passepartout-page";
