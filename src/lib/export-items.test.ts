import { describe, it, expect } from "vitest";
import { exportCoverItem, exportItem } from "./export-items";
import { photoLayoutRatio } from "./frames";
import type { Photo } from "../types";

// A photo carrying every decoration the editor can put on one (issue #121: a cover face used
// to reach the printer with none of them).
const decorated: Photo = {
  id: "p1",
  url: "blob:photo",
  w: 3000,
  h: 2000,
  ratio: 1.5,
  time: 0,
  name: "sky.jpg",
  caption: "on the ferry",
  crop: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
  mask: "rounded",
  maskRadius: 0.28,
  frame: "polaroid",
  frameColor: "white",
  frameText: "day one",
  frameWidth: 0.06,
  frameFocus: { x: 0.4, y: 0.6 },
  rotation: 3,
};

const plain: Photo = { id: "p2", url: "blob:plain", w: 2000, h: 3000, ratio: 2 / 3, time: 0, name: "b.jpg", caption: "" };

describe("exportItem", () => {
  it("carries every decoration to the painter", () => {
    expect(exportItem(decorated, decorated.caption)).toMatchObject({
      photoId: "p1",
      url: "blob:photo",
      caption: "on the ferry",
      crop: decorated.crop,
      mask: "rounded",
      maskRadius: 0.28,
      frame: "polaroid",
      frameColor: "white",
      frameText: "day one",
      frameWidth: 0.06,
      frameFocus: { x: 0.4, y: 0.6 },
      rotation: 3,
    });
  });

  it("sizes the box by the LAYOUT ratio, so a framed photo gets a box shaped for its frame", () => {
    const item = exportItem(decorated, "");
    expect(item.ratio).toBe(photoLayoutRatio(decorated)); // a Polaroid is square, not 1.5
    expect(item.ratio).not.toBe(decorated.ratio);
    expect(item.sourceRatio).toBe(1.5);
    // The kept region of the crop is square here, so the contained photo ratio follows it.
    expect(item.photoRatio).toBeCloseTo(1.5, 5);
  });

  it("leaves an undecorated photo undecorated", () => {
    const item = exportItem(plain, "");
    expect(item.mask).toBeUndefined();
    expect(item.frame).toBeUndefined();
    expect(item.rotation).toBeUndefined();
    expect(item.ratio).toBeCloseTo(2 / 3, 5);
  });

  it("drops the crop and the decorations in full-page mode, as the editor does (spec 012)", () => {
    const item = exportItem(decorated, "", true);
    expect(item.ratio).toBe(1.5); // the source ratio: the page crops it, not the frame
    expect(item.crop).toBeUndefined();
    expect(item.mask).toBeUndefined();
    expect(item.maskRadius).toBeUndefined();
    expect(item.frame).toBeUndefined();
    expect(item.rotation).toBeUndefined();
  });
});

describe("exportCoverItem", () => {
  it("gives a cover photo the same decorations as a page photo, minus the caption", () => {
    const item = exportCoverItem(decorated);
    expect(item.caption).toBe("");
    expect({ ...item, caption: "on the ferry" }).toEqual(exportItem(decorated, "on the ferry"));
  });
});
