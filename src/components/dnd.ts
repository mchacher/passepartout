// Shared drag-and-drop payload keys. Photo drags carry a photo id; page drags carry a
// page id under a distinct MIME type so the two never cross-fire.
export const PHOTO_DND_TYPE = "text/plain";
export const PAGE_DND_TYPE = "application/x-passepartout-page";
// A placed photo also carries its source page id and slot index, so a drop onto another
// slot of the SAME page can swap the two photos (spec 056) instead of being a no-op. A
// library drag has no such payload. Format: "<pageId>:<slotIndex>".
export const PHOTO_SLOT_DND_TYPE = "application/x-passepartout-slot";
