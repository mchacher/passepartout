import "fake-indexeddb/auto";
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { useAlbum } from "./store";
import { clearAll, loadProjectDoc, saveProjectDoc } from "./persistence";
import { newCover, newProjectDoc } from "./lib/project";
import type { ProjectDoc } from "./lib/project";
import type { AlbumPage, CellRect, Photo } from "./types";

// A page's SLOT COUNT is its layout capacity (spec 035), independent of how many photos
// are placed: photoIds fills the first slots and the rest are empty. Photos only enter a
// page by dragging (placeOnPage); the count buttons (setPageCount) set the capacity and
// never pull from the library. syncLayout keeps the invariant photoIds.length <= slotCount.

const photo = (id: string): Photo => ({
  id,
  url: "",
  w: 100,
  h: 100,
  ratio: 1,
  time: 0,
  name: id,
  caption: "",
});

const page = (id: string, photoIds: string[], layoutId: string): AlbumPage => ({
  id,
  title: "",
  subtitle: "",
  photoIds,
  whitespace: 4,
  layoutId,
});

const layoutOf = (pageId: string) =>
  useAlbum.getState().pages.find((p) => p.id === pageId)!.layoutId;

describe("store layout sync", () => {
  it("setPageCount resets the layout to the new count's default when shrinking", () => {
    useAlbum.setState({
      photos: [photo("a"), photo("b"), photo("c")],
      pages: [page("pg", ["a", "b", "c"], "three-row")],
    });
    useAlbum.getState().setPageCount("pg", 2);
    expect(layoutOf("pg")).toBe("two-row"); // defaultLayoutId(2)
    expect(useAlbum.getState().pages[0].photoIds).toHaveLength(2);
  });

  it("setPageCount sets the capacity without pulling photos when growing (spec 035)", () => {
    useAlbum.setState({
      photos: [photo("a"), photo("b"), photo("c"), photo("d")],
      pages: [page("pg", ["a", "b", "c"], "one-beside-two")],
    });
    useAlbum.getState().setPageCount("pg", 4);
    expect(layoutOf("pg")).toBe("four-row"); // defaultLayoutId(4): 4 slots
    // No photo is pulled from the library; the page still holds only its three photos.
    expect(useAlbum.getState().pages[0].photoIds).toEqual(["a", "b", "c"]);
  });

  it("setPageCount never borrows an unused library photo (spec 035)", () => {
    useAlbum.setState({
      photos: [photo("a"), photo("b"), photo("c"), photo("d"), photo("e")],
      pages: [page("p1", ["a"], "single"), page("p2", ["b"], "single")],
    });
    useAlbum.getState().setPageCount("p1", 3); // c, d, e are unused but must NOT be pulled
    const s = useAlbum.getState();
    expect(layoutOf("p1")).toBe("three-row"); // 3 slots
    expect(s.pages.find((p) => p.id === "p1")!.photoIds).toEqual(["a"]); // still just "a"
  });

  it("setPageCount shrinks the capacity and returns the overflow to the library (spec 035)", () => {
    useAlbum.setState({
      photos: [photo("a"), photo("b"), photo("c"), photo("d")],
      pages: [page("pg", ["a", "b", "c", "d"], "grid-2x2")],
    });
    useAlbum.getState().setPageCount("pg", 2);
    const s = useAlbum.getState();
    expect(layoutOf("pg")).toBe("two-row"); // 2 slots
    expect(s.pages[0].photoIds).toEqual(["a", "b"]); // c, d dropped from the page
    expect(s.photos.map((p) => p.id)).toContain("c"); // but still in the library
    expect(s.photos.map((p) => p.id)).toContain("d");
  });

  it("setPageCount keeps a custom layout when the count is unchanged", () => {
    useAlbum.setState({
      photos: [photo("a"), photo("b"), photo("c")],
      pages: [page("pg", ["a", "b", "c"], "one-beside-two")],
    });
    useAlbum.getState().setPageCount("pg", 3);
    expect(layoutOf("pg")).toBe("one-beside-two");
  });

  it("setPageLayout changes only the target page", () => {
    useAlbum.setState({
      photos: [
        photo("a"),
        photo("b"),
        photo("c"),
        photo("d"),
        photo("e"),
        photo("f"),
      ],
      pages: [
        page("p1", ["a", "b", "c"], "three-row"),
        page("p2", ["d", "e", "f"], "three-row"),
      ],
    });
    useAlbum.getState().setPageLayout("p1", "one-over-two");
    expect(layoutOf("p1")).toBe("one-over-two");
    expect(layoutOf("p2")).toBe("three-row");
  });

  it("placeOnPage grows the layout when dropping onto a full page (spec 035)", () => {
    useAlbum.setState({
      photos: [photo("a"), photo("b"), photo("c"), photo("d")],
      pages: [page("pg", ["a", "b", "c"], "two-over-one")],
    });
    useAlbum.getState().placeOnPage("d", "pg"); // page was full (3 slots) -> grow to 4
    expect(useAlbum.getState().pages[0].photoIds).toHaveLength(4);
    expect(layoutOf("pg")).toBe("four-row");
  });

  it("placeOnPage fills a free slot without changing the capacity (spec 035)", () => {
    useAlbum.setState({
      photos: [photo("a"), photo("b"), photo("c")],
      pages: [page("pg", ["a"], "three-row")], // 3 slots, only 1 filled
    });
    useAlbum.getState().placeOnPage("b", "pg");
    expect(useAlbum.getState().pages[0].photoIds).toEqual(["a", "b"]);
    expect(layoutOf("pg")).toBe("three-row"); // still 3 slots, one now empty
  });

  it("removeFromPage leaves the capacity unchanged: an empty slot appears (spec 035)", () => {
    useAlbum.setState({
      photos: [photo("a"), photo("b"), photo("c")],
      pages: [page("pg", ["a", "b", "c"], "one-beside-two")],
    });
    useAlbum.getState().removeFromPage("c", "pg");
    expect(useAlbum.getState().pages[0].photoIds).toEqual(["a", "b"]);
    expect(layoutOf("pg")).toBe("one-beside-two"); // still a 3-slot page, one slot now empty
  });
});

describe("store photo reuse (spec 017)", () => {
  const idsOf = (pageId: string) => useAlbum.getState().pages.find((p) => p.id === pageId)!.photoIds;

  it("placeOnPage adds to the target and keeps the photo on its other pages", () => {
    useAlbum.setState({
      photos: [photo("a")],
      pages: [page("p1", ["a"], "single"), page("p2", [], "single")],
    });
    useAlbum.getState().placeOnPage("a", "p2");
    expect(idsOf("p1")).toEqual(["a"]); // still on p1
    expect(idsOf("p2")).toEqual(["a"]); // and now on p2
  });

  it("placeOnPage onto a page already holding the photo is a no-op", () => {
    useAlbum.setState({ photos: [photo("a")], pages: [page("p1", ["a"], "single")] });
    useAlbum.getState().placeOnPage("a", "p1");
    expect(idsOf("p1")).toEqual(["a"]); // no duplicate
  });

  it("removeFromPage removes from one page only, leaving the reuse on others", () => {
    useAlbum.setState({
      photos: [photo("a")],
      pages: [page("p1", ["a"], "single"), page("p2", ["a"], "single")],
    });
    useAlbum.getState().removeFromPage("a", "p1");
    expect(idsOf("p1")).toEqual([]);
    expect(idsOf("p2")).toEqual(["a"]); // reuse survives
  });

  it("unplaceFromAllPages removes the photo from every page", () => {
    useAlbum.setState({
      photos: [photo("a"), photo("b")],
      pages: [page("p1", ["a", "b"], "two-row"), page("p2", ["a"], "single")],
    });
    useAlbum.getState().unplaceFromAllPages("a");
    expect(idsOf("p1")).toEqual(["b"]);
    expect(idsOf("p2")).toEqual([]);
  });

  it("deletePage keeps its photos in the library (they may be reused elsewhere)", () => {
    useAlbum.setState({
      photos: [photo("a"), photo("b")],
      pages: [page("p1", ["a"], "single"), page("p2", ["a", "b"], "two-row")],
    });
    useAlbum.getState().deletePage("p2");
    expect(useAlbum.getState().photos.map((p) => p.id)).toEqual(["a", "b"]); // photos kept
    expect(idsOf("p1")).toEqual(["a"]);
  });
});

describe("store full-page mode (spec 012)", () => {
  const fullPageOf = (pageId: string) =>
    useAlbum.getState().pages.find((p) => p.id === pageId)!.fullPage;

  it("setPageFullPage sets and clears the mode on the target page only", () => {
    useAlbum.setState({
      photos: [photo("a"), photo("b")],
      pages: [page("p1", ["a"], "single"), page("p2", ["b"], "single")],
    });
    useAlbum.getState().setPageFullPage("p1", "cover");
    expect(fullPageOf("p1")).toBe("cover");
    expect(fullPageOf("p2")).toBeUndefined(); // other page untouched
    useAlbum.getState().setPageFullPage("p1", null);
    expect(fullPageOf("p1")).toBeUndefined();
  });

  it("setPageFullPageFocus clamps each axis to [0,1]", () => {
    useAlbum.setState({
      photos: [photo("a")],
      pages: [page("p1", ["a"], "single")],
    });
    useAlbum.getState().setPageFullPageFocus("p1", { x: 2, y: -1 });
    expect(useAlbum.getState().pages[0].fullPageFocus).toEqual({ x: 1, y: 0 });
  });

  it("clears full-page mode when the page stops holding exactly one photo", () => {
    useAlbum.setState({
      photos: [photo("a"), photo("b")],
      pages: [{ ...page("p1", ["a"], "single"), fullPage: "cover" }],
    });
    useAlbum.getState().placeOnPage("b", "p1"); // now 2 photos
    expect(fullPageOf("p1")).toBeUndefined();
  });
});

describe("store custom grid placement (spec 013)", () => {
  const placementOf = (pageId: string) =>
    useAlbum.getState().pages.find((p) => p.id === pageId)!.placement;
  const twoCells = [
    { col: 0, row: 0, colSpan: 8, rowSpan: 12 },
    { col: 8, row: 0, colSpan: 4, rowSpan: 12 },
  ];

  it("setPageLayout clears a custom placement (re-attaches to the template)", () => {
    useAlbum.setState({
      photos: [photo("a"), photo("b")],
      pages: [{ ...page("p1", ["a", "b"], "two-row"), placement: twoCells }],
    });
    useAlbum.getState().setPageLayout("p1", "two-col");
    expect(placementOf("p1")).toBeUndefined();
    expect(layoutOf("p1")).toBe("two-col");
  });

  it("setPagePlacement stores the placement on the target page only", () => {
    useAlbum.setState({
      photos: [photo("a"), photo("b")],
      pages: [page("p1", ["a", "b"], "two-row")],
    });
    useAlbum.getState().setPagePlacement("p1", twoCells);
    expect(placementOf("p1")).toEqual(twoCells);
  });

  it("removeFromPage keeps all placement cells; a slot just goes empty (spec 035)", () => {
    useAlbum.setState({
      photos: [photo("a"), photo("b")],
      pages: [{ ...page("p1", ["a", "b"], "two-row"), placement: twoCells }],
    });
    useAlbum.getState().removeFromPage("a", "p1");
    expect(useAlbum.getState().pages[0].photoIds).toEqual(["b"]);
    expect(placementOf("p1")).toEqual(twoCells); // capacity unchanged: both cells kept, one empty
  });

  it("placeOnPage onto a full custom page grows to a template and drops the placement (spec 035)", () => {
    useAlbum.setState({
      photos: [photo("a"), photo("b"), photo("c")],
      pages: [{ ...page("p1", ["a", "b"], "two-row"), placement: twoCells }], // full: 2 slots
    });
    useAlbum.getState().placeOnPage("c", "p1"); // beyond the 2 slots -> grow to a 3-slot layout
    expect(useAlbum.getState().pages[0].photoIds).toEqual(["a", "b", "c"]);
    expect(placementOf("p1")).toBeUndefined();
    expect(layoutOf("p1")).toBe("three-row");
  });

  it("placeOnPage onto a photo's own page is a no-op (keeps the placement)", () => {
    useAlbum.setState({
      photos: [photo("a"), photo("b")],
      pages: [{ ...page("p1", ["a", "b"], "two-row"), placement: twoCells }],
    });
    useAlbum.getState().placeOnPage("a", "p1"); // already on p1
    expect(useAlbum.getState().pages[0].photoIds).toEqual(["a", "b"]);
    expect(placementOf("p1")).toEqual(twoCells);
  });

  it("setPageCount (a coarse reset) drops the custom placement", () => {
    useAlbum.setState({
      photos: [photo("a"), photo("b"), photo("c")],
      pages: [{ ...page("p1", ["a", "b"], "two-row"), placement: twoCells }],
    });
    useAlbum.getState().setPageCount("p1", 3);
    expect(placementOf("p1")).toBeUndefined();
  });
});

describe("store photo crop (spec 015)", () => {
  const cropOf = (id: string) => useAlbum.getState().photos.find((p) => p.id === id)!.crop;

  it("setPhotoCrop sets a clamped crop and clears it with null", () => {
    useAlbum.setState({ photos: [photo("a"), photo("b")], pages: [page("p1", ["a", "b"], "two-row")] });
    useAlbum.getState().setPhotoCrop("a", { x: -0.5, y: 0.2, w: 2, h: 0.4 });
    expect(cropOf("a")).toEqual({ x: 0, y: 0.2, w: 1, h: 0.4 }); // clamped
    expect(cropOf("b")).toBeUndefined(); // other photo untouched
    useAlbum.getState().setPhotoCrop("a", null);
    expect(cropOf("a")).toBeUndefined();
  });
});

describe("store photo mask (spec 018)", () => {
  const maskOf = (id: string) => useAlbum.getState().photos.find((p) => p.id === id)!.mask;

  it("setPhotoMask sets a known mask, clears it, and rejects an unknown id", () => {
    useAlbum.setState({ photos: [photo("a"), photo("b")], pages: [page("p1", ["a", "b"], "two-row")] });
    useAlbum.getState().setPhotoMask("a", "oval");
    expect(maskOf("a")).toBe("oval");
    expect(maskOf("b")).toBeUndefined(); // other photo untouched
    useAlbum.getState().setPhotoMask("a", "not-a-mask");
    expect(maskOf("a")).toBeUndefined(); // unknown id never persisted
    useAlbum.getState().setPhotoMask("a", "arch");
    useAlbum.getState().setPhotoMask("a", null);
    expect(maskOf("a")).toBeUndefined(); // cleared
  });
});

describe("store photo frame (spec 019)", () => {
  const photoOf = (id: string) => useAlbum.getState().photos.find((p) => p.id === id)!;

  it("setPhotoFrame keeps a known id, rejects an unknown one, and clears with the note", () => {
    useAlbum.setState({ photos: [photo("a"), photo("b")], pages: [page("p1", ["a", "b"], "two-row")] });
    useAlbum.getState().setPhotoFrame("a", "polaroid");
    useAlbum.getState().setPhotoFrameText("a", "Summer 2026");
    expect(photoOf("a").frame).toBe("polaroid");
    expect(photoOf("a").frameText).toBe("Summer 2026");
    expect(photoOf("b").frame).toBeUndefined(); // other photo untouched
    useAlbum.getState().setPhotoFrame("a", "not-a-frame");
    expect(photoOf("a").frame).toBeUndefined(); // unknown id never persisted
    useAlbum.getState().setPhotoFrame("a", "border");
    useAlbum.getState().setPhotoFrameText("a", "note");
    useAlbum.getState().setPhotoFrame("a", null);
    expect(photoOf("a").frame).toBeUndefined();
    expect(photoOf("a").frameText).toBeUndefined(); // clearing the frame drops the note
  });

  it("setPhotoFrameColor keeps a palette id and clears an unknown one; empty note clears", () => {
    useAlbum.setState({ photos: [photo("a")], pages: [page("p1", ["a"], "single")] });
    useAlbum.getState().setPhotoFrameColor("a", "kraft");
    expect(photoOf("a").frameColor).toBe("kraft");
    useAlbum.getState().setPhotoFrameColor("a", "chartreuse");
    expect(photoOf("a").frameColor).toBeUndefined();
    useAlbum.getState().setPhotoFrameText("a", "  ");
    expect(photoOf("a").frameText).toBeUndefined(); // blank note is no note
  });

  it("setPhotoRotation clamps to the range, stores it, and 0 clears it", () => {
    useAlbum.setState({ photos: [photo("a"), photo("b")], pages: [page("p1", ["a", "b"], "two-row")] });
    useAlbum.getState().setPhotoRotation("a", 10);
    expect(photoOf("a").rotation).toBe(10);
    expect(photoOf("b").rotation).toBeUndefined(); // other photo untouched
    useAlbum.getState().setPhotoRotation("a", 90);
    expect(photoOf("a").rotation).toBe(30); // clamped to ROTATION_MAX
    useAlbum.getState().setPhotoRotation("a", 0);
    expect(photoOf("a").rotation).toBeUndefined(); // level clears the field
  });

  it("setPhotoFrameWidth clamps, setPhotoFrameFocus clamps, and clearing the frame drops both", () => {
    useAlbum.setState({ photos: [photo("a")], pages: [page("p1", ["a"], "single")] });
    useAlbum.getState().setPhotoFrame("a", "border");
    useAlbum.getState().setPhotoFrameWidth("a", 0.04);
    useAlbum.getState().setPhotoFrameFocus("a", { x: 2, y: -1 });
    expect(photoOf("a").frameWidth).toBe(0.04);
    expect(photoOf("a").frameFocus).toEqual({ x: 1, y: 0 }); // clamped to [0,1]
    useAlbum.getState().setPhotoFrame("a", null);
    expect(photoOf("a").frameWidth).toBeUndefined();
    expect(photoOf("a").frameFocus).toBeUndefined();
  });
});

describe("store page reorder", () => {
  const ids = () => useAlbum.getState().pages.map((p) => p.id);

  const seed = () =>
    useAlbum.setState({
      photos: [photo("x"), photo("y")],
      pages: [
        page("p1", ["x"], "single"),
        page("p2", [], "single"),
        page("p3", ["y"], "single"),
        page("p4", [], "single"),
      ],
    });

  it("moves a page to a later slot", () => {
    seed();
    useAlbum.getState().movePage("p1", 2); // insert p1 into slot 2 (between p2 and p3)
    expect(ids()).toEqual(["p2", "p1", "p3", "p4"]);
  });

  it("moves a page to the very front and to the very end", () => {
    seed();
    useAlbum.getState().movePage("p3", 0);
    expect(ids()).toEqual(["p3", "p1", "p2", "p4"]);
    seed();
    useAlbum.getState().movePage("p2", 4); // slot == length -> end
    expect(ids()).toEqual(["p1", "p3", "p4", "p2"]);
  });

  it("clamps an out-of-range slot to the end", () => {
    seed();
    useAlbum.getState().movePage("p1", 99);
    expect(ids()).toEqual(["p2", "p3", "p4", "p1"]);
  });

  it("is a no-op when dropped in its own neighborhood or for an unknown id", () => {
    seed();
    useAlbum.getState().movePage("p2", 1); // slot 1 is p2's own position
    expect(ids()).toEqual(["p1", "p2", "p3", "p4"]);
    useAlbum.getState().movePage("p2", 2); // slot just after itself
    expect(ids()).toEqual(["p1", "p2", "p3", "p4"]);
    useAlbum.getState().movePage("nope", 0);
    expect(ids()).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("does not touch photos or a page's photoIds / layoutId", () => {
    seed();
    const photosBefore = useAlbum.getState().photos;
    useAlbum.getState().movePage("p1", 3);
    const s = useAlbum.getState();
    expect(s.photos).toBe(photosBefore); // reference unchanged
    const p1 = s.pages.find((p) => p.id === "p1")!;
    expect(p1.photoIds).toEqual(["x"]);
    expect(p1.layoutId).toBe("single");
  });
});

describe("store insert page (spec 053)", () => {
  const ids = () => useAlbum.getState().pages.map((p) => p.id);

  const seed = () =>
    useAlbum.setState({
      photos: [photo("x"), photo("y")],
      pages: [
        page("p1", ["x"], "single"),
        page("p2", [], "single"),
        page("p3", ["y"], "single"),
      ],
    });

  it("inserts a fresh blank page before the first page (slot 0)", () => {
    seed();
    useAlbum.getState().insertPage(0);
    const s = useAlbum.getState();
    expect(s.pages).toHaveLength(4);
    expect(ids().slice(1)).toEqual(["p1", "p2", "p3"]);
    expect(s.pages[0].photoIds).toEqual([]); // brand new empty page
    expect(s.pages[0].layoutId).toBe("single");
  });

  it("inserts between existing pages (slot k) and shifts the rest down", () => {
    seed();
    useAlbum.getState().insertPage(2); // between p2 and p3
    const s = useAlbum.getState();
    expect(ids()[0]).toBe("p1");
    expect(ids()[1]).toBe("p2");
    expect(ids()[3]).toBe("p3");
    expect(s.pages[2].photoIds).toEqual([]); // the inserted one
  });

  it("appends when the slot equals the length, and clamps out-of-range", () => {
    seed();
    useAlbum.getState().insertPage(3); // == length -> after the last
    expect(ids().slice(0, 3)).toEqual(["p1", "p2", "p3"]);
    expect(useAlbum.getState().pages).toHaveLength(4);
    seed();
    useAlbum.getState().insertPage(99); // clamped to the end
    expect(ids().slice(0, 3)).toEqual(["p1", "p2", "p3"]);
    expect(useAlbum.getState().pages).toHaveLength(4);
    seed();
    useAlbum.getState().insertPage(-5); // clamped to the front
    expect(ids().slice(1)).toEqual(["p1", "p2", "p3"]);
  });

  it("gives every inserted page a unique id and touches no existing page", () => {
    seed();
    const before = useAlbum.getState().pages.find((p) => p.id === "p1")!;
    useAlbum.getState().insertPage(1);
    const s = useAlbum.getState();
    expect(new Set(s.pages.map((p) => p.id)).size).toBe(s.pages.length);
    expect(s.pages.find((p) => p.id === "p1")).toBe(before); // reference unchanged
  });
});

describe("store swap photos on a page (spec 056)", () => {
  const idsOf = (pageId: string) => useAlbum.getState().pages.find((p) => p.id === pageId)!.photoIds;

  const seed = () =>
    useAlbum.setState({
      photos: [photo("a"), photo("b"), photo("c")],
      pages: [page("pg", ["a", "b", "c"], "three-row")],
    });

  it("swaps two photos by slot index", () => {
    seed();
    useAlbum.getState().swapPhotosOnPage("pg", 0, 2);
    expect(idsOf("pg")).toEqual(["c", "b", "a"]);
    useAlbum.getState().swapPhotosOnPage("pg", 0, 1);
    expect(idsOf("pg")).toEqual(["b", "c", "a"]);
  });

  it("is a no-op for equal, out-of-range, or unknown targets", () => {
    seed();
    useAlbum.getState().swapPhotosOnPage("pg", 1, 1); // same slot
    expect(idsOf("pg")).toEqual(["a", "b", "c"]);
    useAlbum.getState().swapPhotosOnPage("pg", 0, 9); // out of range
    expect(idsOf("pg")).toEqual(["a", "b", "c"]);
    useAlbum.getState().swapPhotosOnPage("pg", -1, 2); // negative
    expect(idsOf("pg")).toEqual(["a", "b", "c"]);
    useAlbum.getState().swapPhotosOnPage("nope", 0, 1); // unknown page
    expect(idsOf("pg")).toEqual(["a", "b", "c"]);
  });

  it("keeps the layout capacity and a custom placement (slot geometry) unchanged", () => {
    useAlbum.setState({
      photos: [photo("a"), photo("b")],
      pages: [page("pg", ["a", "b"], "two-col")],
    });
    const placement: CellRect[] = [
      { col: 0, row: 0, colSpan: 6, rowSpan: 12 },
      { col: 6, row: 0, colSpan: 6, rowSpan: 12 },
    ];
    useAlbum.getState().setPagePlacement("pg", placement);
    useAlbum.getState().swapPhotosOnPage("pg", 0, 1);
    const pg = useAlbum.getState().pages.find((p) => p.id === "pg")!;
    expect(pg.photoIds).toEqual(["b", "a"]); // occupants exchanged
    expect(pg.layoutId).toBe("two-col"); // capacity untouched
    expect(pg.placement).toEqual(placement); // per-slot geometry untouched
  });

  it("does not touch the photo library", () => {
    seed();
    const photosBefore = useAlbum.getState().photos;
    useAlbum.getState().swapPhotosOnPage("pg", 0, 2);
    expect(useAlbum.getState().photos).toBe(photosBefore); // reference unchanged
  });
});

describe("store project management", () => {
  beforeAll(() => {
    // jsdom-less node has no object URL API; the CRUD paths never render, so stub it.
    globalThis.URL.createObjectURL ??= () => "blob:test";
    globalThis.URL.revokeObjectURL ??= () => {};
  });

  beforeEach(async () => {
    await clearAll();
    useAlbum.setState({
      photos: [],
      pages: [],
      bookSize: "blurb-square-7",
      spine: { title: "" },
      projects: [],
      activeId: null,
      activeCreatedAt: 0,
      ready: false,
      persistent: false,
    });
    await useAlbum.getState().initProjects();
  });

  it("initProjects marks persistence available with no projects yet", () => {
    const s = useAlbum.getState();
    expect(s.persistent).toBe(true);
    expect(s.ready).toBe(true);
    expect(s.projects).toEqual([]);
    expect(s.activeId).toBeNull();
  });

  it("createProject sets an active empty project and lists it", async () => {
    await useAlbum.getState().createProject("Holiday");
    const s = useAlbum.getState();
    expect(s.activeId).not.toBeNull();
    expect(s.activeName).toBe("Holiday");
    expect(s.photos).toEqual([]);
    expect(s.pages).toEqual([]);
    expect(s.projects.map((m) => m.name)).toContain("Holiday");
  });

  it("renameProject updates the active name and its meta", async () => {
    await useAlbum.getState().createProject("Old");
    const id = useAlbum.getState().activeId!;
    await useAlbum.getState().renameProject(id, "New");
    const s = useAlbum.getState();
    expect(s.activeName).toBe("New");
    expect(s.projects.find((m) => m.id === id)!.name).toBe("New");
  });

  it("duplicateProject creates a distinct active copy in the list", async () => {
    await useAlbum.getState().createProject("Base");
    const srcId = useAlbum.getState().activeId!;
    await useAlbum.getState().duplicateProject(srcId);
    const s = useAlbum.getState();
    expect(s.activeId).not.toBe(srcId);
    expect(s.projects).toHaveLength(2);
    expect(s.projects.some((m) => m.name === "Base copy")).toBe(true);
  });

  it("deleteProject switches to the remaining project", async () => {
    await useAlbum.getState().createProject("First");
    const firstId = useAlbum.getState().activeId!;
    await useAlbum.getState().createProject("Second");
    const secondId = useAlbum.getState().activeId!;
    await useAlbum.getState().deleteProject(secondId);
    const s = useAlbum.getState();
    expect(s.projects.map((m) => m.id)).toEqual([firstId]);
    expect(s.activeId).toBe(firstId);
  });

  it("deleteProject of the only project falls back to the empty state", async () => {
    await useAlbum.getState().createProject("Solo");
    const id = useAlbum.getState().activeId!;
    await useAlbum.getState().deleteProject(id);
    const s = useAlbum.getState();
    expect(s.projects).toEqual([]);
    expect(s.activeId).toBeNull();
    expect(s.photos).toEqual([]);
  });

  it("flushes the outgoing project's pending edit when switching away", async () => {
    await useAlbum.getState().createProject("A");
    const aId = useAlbum.getState().activeId!;
    useAlbum.getState().addPage();
    const pageId = useAlbum.getState().pages[0].id;
    useAlbum.getState().setPageTitle(pageId, "kept edit");
    // The 400ms debounce has NOT elapsed; switching must flush A's edit explicitly,
    // or it would be lost (and a stale timer could later write under B's id).
    await useAlbum.getState().createProject("B");
    const aDoc = await loadProjectDoc(aId);
    expect(aDoc?.pages.find((p) => p.id === pageId)?.title).toBe("kept edit");
  });

  it("updateCover changes only the target cover face", async () => {
    await useAlbum.getState().createProject("X");
    useAlbum.getState().updateCover("front", { title: "Front title" });
    useAlbum.getState().updateCover("insideFront", { title: "Dedication" });
    useAlbum.getState().updateCover("back", { subtitle: "Back note" });
    const s = useAlbum.getState();
    expect(s.frontCover.title).toBe("Front title");
    expect(s.insideFrontCover.title).toBe("Dedication");
    expect(s.insideBackCover.title).toBe(""); // untouched
    expect(s.backCover.subtitle).toBe("Back note");
    expect(s.frontCover.subtitle).toBe(""); // untouched
  });

  it("persists covers with the project", async () => {
    await useAlbum.getState().createProject("Cov");
    const id = useAlbum.getState().activeId!;
    useAlbum.getState().updateCover("front", { title: "Hello", subtitle: "2026" });
    await useAlbum.getState().createProject("Other"); // flushes Cov on switch
    const doc = await loadProjectDoc(id);
    expect(doc?.frontCover).toMatchObject({ title: "Hello", subtitle: "2026" });
  });

  it("setFontTheme and setColorTheme change only their own field", async () => {
    await useAlbum.getState().createProject("Styled");
    useAlbum.getState().setFontTheme("rounded");
    useAlbum.getState().setColorTheme("slate");
    const s = useAlbum.getState();
    expect(s.fontTheme).toBe("rounded");
    expect(s.colorTheme).toBe("slate");
    expect(s.bookSize).toBe("blurb-square-7"); // untouched
  });

  it("setBookSize and setSpineTitle change only their own field", async () => {
    await useAlbum.getState().createProject("Sized");
    useAlbum.getState().setBookSize("blurb-portrait-8x10");
    useAlbum.getState().setSpineTitle("The Spine");
    const s = useAlbum.getState();
    expect(s.bookSize).toBe("blurb-portrait-8x10");
    expect(s.spine).toEqual({ title: "The Spine" });
    expect(s.fontTheme).toBe("serif"); // untouched
  });

  it("migrates a legacy project's format to a Blurb size and default spine on open", async () => {
    const legacy = newProjectDoc("LegacyFormat", 1);
    legacy.id = "legacy-format";
    delete (legacy as Partial<ProjectDoc>).bookSize;
    delete (legacy as Partial<ProjectDoc>).spine;
    (legacy as unknown as { format: string }).format = "landscape";
    await saveProjectDoc(legacy as ProjectDoc);
    await useAlbum.getState().openProject("legacy-format");
    const s = useAlbum.getState();
    expect(s.bookSize).toBe("blurb-landscape-10x8");
    expect(s.spine).toEqual({ title: "" });
  });

  it("createProject resets the theme to the defaults", async () => {
    await useAlbum.getState().createProject("A");
    useAlbum.getState().setFontTheme("typewriter");
    useAlbum.getState().setColorTheme("sage");
    await useAlbum.getState().createProject("B");
    const s = useAlbum.getState();
    expect(s.fontTheme).toBe("serif");
    expect(s.colorTheme).toBe("classic");
  });

  it("persists the theme with the project and restores it on open", async () => {
    await useAlbum.getState().createProject("Themed");
    const id = useAlbum.getState().activeId!;
    useAlbum.getState().setFontTheme("humanist");
    useAlbum.getState().setColorTheme("warm");
    await useAlbum.getState().createProject("Other"); // flush Themed on switch
    await useAlbum.getState().openProject(id);
    const s = useAlbum.getState();
    expect(s.fontTheme).toBe("humanist");
    expect(s.colorTheme).toBe("warm");
  });

  it("defaults the theme when opening a project saved before it existed", async () => {
    const legacy = newProjectDoc("LegacyTheme", 1);
    legacy.id = "legacy-theme";
    delete (legacy as Partial<ProjectDoc>).fontTheme;
    delete (legacy as Partial<ProjectDoc>).colorTheme;
    await saveProjectDoc(legacy as ProjectDoc);
    await useAlbum.getState().openProject("legacy-theme");
    const s = useAlbum.getState();
    expect(s.fontTheme).toBe("serif");
    expect(s.colorTheme).toBe("classic");
  });

  const ALL_MD = {
    coverTitle: "md",
    coverSubtitle: "md",
    pageTitle: "md",
    pageSubtitle: "md",
    caption: "md",
  } as const;

  it("setTextSize changes only the target role", async () => {
    await useAlbum.getState().createProject("Sized");
    useAlbum.getState().setTextSize("coverTitle", "xl");
    useAlbum.getState().setTextSize("caption", "sm");
    const s = useAlbum.getState();
    expect(s.textSizes).toEqual({ ...ALL_MD, coverTitle: "xl", caption: "sm" });
  });

  it("createProject resets the text sizes to the defaults", async () => {
    await useAlbum.getState().createProject("A");
    useAlbum.getState().setTextSize("pageTitle", "xl");
    await useAlbum.getState().createProject("B");
    expect(useAlbum.getState().textSizes).toEqual(ALL_MD);
  });

  it("persists the text sizes and restores them on open", async () => {
    await useAlbum.getState().createProject("Sized");
    const id = useAlbum.getState().activeId!;
    useAlbum.getState().setTextSize("pageSubtitle", "lg");
    await useAlbum.getState().createProject("Other"); // flush on switch
    await useAlbum.getState().openProject(id);
    expect(useAlbum.getState().textSizes.pageSubtitle).toBe("lg");
  });

  it("defaults the text sizes (and drops old 005 keys) for a legacy project", async () => {
    const legacy = newProjectDoc("LegacySizes", 1);
    legacy.id = "legacy-sizes";
    // Simulate spec 005's old shape, which has none of the new role keys.
    (legacy as unknown as { textSizes: unknown }).textSizes = { title: "lg", subtitle: "lg", caption: "xl" };
    await saveProjectDoc(legacy as ProjectDoc);
    await useAlbum.getState().openProject("legacy-sizes");
    expect(useAlbum.getState().textSizes).toEqual({ ...ALL_MD, caption: "xl" });
  });

  it("setPageSubtitle changes only the target page", async () => {
    useAlbum.setState({
      photos: [],
      pages: [page("p1", [], "single"), page("p2", [], "single")],
    });
    useAlbum.getState().setPageSubtitle("p1", "a note");
    const pages = useAlbum.getState().pages;
    expect(pages.find((p) => p.id === "p1")!.subtitle).toBe("a note");
    expect(pages.find((p) => p.id === "p2")!.subtitle).toBe("");
  });

  it("normalizes a page saved before subtitles existed to an empty subtitle", async () => {
    const legacy = newProjectDoc("LegacyPage", 1);
    legacy.id = "legacy-page";
    legacy.pages = [
      { id: "old", title: "Old", photoIds: [], whitespace: 4, layoutId: "single" } as unknown as AlbumPage,
    ];
    await saveProjectDoc(legacy as ProjectDoc);
    await useAlbum.getState().openProject("legacy-page");
    expect(useAlbum.getState().pages[0].subtitle).toBe("");
  });

  it("defaults covers when opening a project saved before covers existed", async () => {
    const legacy = newProjectDoc("Legacy", 1);
    legacy.id = "legacy";
    // Simulate an old document that predates the cover fields (all four).
    delete (legacy as Partial<ProjectDoc>).frontCover;
    delete (legacy as Partial<ProjectDoc>).insideFrontCover;
    delete (legacy as Partial<ProjectDoc>).insideBackCover;
    delete (legacy as Partial<ProjectDoc>).backCover;
    await saveProjectDoc(legacy as ProjectDoc);
    await useAlbum.getState().openProject("legacy");
    const s = useAlbum.getState();
    expect(s.frontCover).toEqual(newCover());
    expect(s.insideFrontCover).toEqual(newCover());
    expect(s.insideBackCover).toEqual(newCover());
    expect(s.backCover).toEqual(newCover());
  });
});
