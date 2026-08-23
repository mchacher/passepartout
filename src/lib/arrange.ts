// When a page can be arranged by hand (spec 038, issue 84). Free placement operates on real
// cells, so it needs a page whose every slot holds a photo (spec 035): an empty cell has no
// photo to move or resize. A full-page photo (spec 012) owns the whole page and has no cells
// at all. Pure, so the rule that gates the click lives in one tested place rather than inline
// in the component.
export function canArrange(placed: number, slots: number, isFullPage: boolean): boolean {
  return placed >= 1 && placed === slots && !isFullPage;
}
