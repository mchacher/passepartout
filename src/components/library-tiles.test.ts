import { describe, it, expect } from "vitest";

// The library tray lays its thumbnails out in a CSS grid whose rows must be as tall as the
// square tiles they hold. That contract is invisible to a unit test (there is no DOM layout
// here), so this guards the two declarations it rests on, measured in Chrome on a 25 photo
// library (issue 83):
//
//   auto rows      -> row tracks 60.69px for 110px tiles, every row overlapping the previous
//                     one by 56px, and worse the more photos the library holds, because the
//                     tracks are equalised to fill the panel height
//   auto-rows-max  -> row tracks 110px, pitch 120px, no overlap at any density
//
// The image is absolutely positioned for the same reason it is everywhere else in the app
// (`Thumb`, `PreviewPaper`): the tile owns its height, the photo only fills it, contained so
// that no framing is ever cropped.
const source = (await import("./Library.tsx?raw")).default as string;

const gridClass = /className="(grid [^"]*)"/.exec(source)?.[1] ?? "";
const imgClass = /<img\s[\s\S]*?className="([^"]*)"/.exec(source)?.[1] ?? "";

describe("library tiles", () => {
  it("reads the Library source", () => {
    expect(gridClass).not.toBe("");
    expect(imgClass).not.toBe("");
  });

  it("sizes the grid rows to their content, so a row is never shorter than its tile", () => {
    expect(gridClass).toContain("auto-rows-max");
  });

  it("keeps the tile square and clipping", () => {
    expect(source).toContain("aspect-square");
    expect(source).toContain("overflow-hidden");
  });

  it("contains the photo in the tile without taking part in its sizing", () => {
    expect(imgClass).toContain("absolute");
    expect(imgClass).toContain("object-contain");
  });
});
