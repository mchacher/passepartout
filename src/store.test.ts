import { describe, it, expect } from "vitest";
import { useAlbum } from "./store";
import type { AlbumPage, Photo } from "./types";

// syncLayout is the load-bearing rule: a page's layoutId must always match a
// template whose leaf count equals the page's photo count. Any action that changes
// the count has to keep that invariant, or a persisted layout would render wrong.

const photo = (id: string, pageId: string | null = null): Photo => ({
  id,
  url: "",
  w: 100,
  h: 100,
  ratio: 1,
  time: 0,
  name: id,
  caption: "",
  pageId,
});

const page = (id: string, photoIds: string[], layoutId: string): AlbumPage => ({
  id,
  title: "",
  photoIds,
  whitespace: 4,
  layoutId,
});

const layoutOf = (pageId: string) =>
  useAlbum.getState().pages.find((p) => p.id === pageId)!.layoutId;

describe("store layout sync", () => {
  it("setPageCount resets the layout to the new count's default when shrinking", () => {
    useAlbum.setState({
      photos: [photo("a", "pg"), photo("b", "pg"), photo("c", "pg")],
      pages: [page("pg", ["a", "b", "c"], "three-row")],
    });
    useAlbum.getState().setPageCount("pg", 2);
    expect(layoutOf("pg")).toBe("two-row"); // defaultLayoutId(2)
    expect(useAlbum.getState().pages[0].photoIds).toHaveLength(2);
  });

  it("setPageCount resets the layout when growing from the library pool", () => {
    useAlbum.setState({
      photos: [photo("a", "pg"), photo("b", "pg"), photo("c", "pg"), photo("d", null)],
      pages: [page("pg", ["a", "b", "c"], "one-beside-two")],
    });
    useAlbum.getState().setPageCount("pg", 4);
    expect(layoutOf("pg")).toBe("four-row"); // defaultLayoutId(4)
  });

  it("setPageCount keeps a custom layout when the count is unchanged", () => {
    useAlbum.setState({
      photos: [photo("a", "pg"), photo("b", "pg"), photo("c", "pg")],
      pages: [page("pg", ["a", "b", "c"], "one-beside-two")],
    });
    useAlbum.getState().setPageCount("pg", 3);
    expect(layoutOf("pg")).toBe("one-beside-two");
  });

  it("setPageLayout changes only the target page", () => {
    useAlbum.setState({
      photos: [
        photo("a", "p1"),
        photo("b", "p1"),
        photo("c", "p1"),
        photo("d", "p2"),
        photo("e", "p2"),
        photo("f", "p2"),
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

  it("placeOnPage across a count boundary re-syncs the layout", () => {
    useAlbum.setState({
      photos: [photo("a", "pg"), photo("b", "pg"), photo("c", "pg"), photo("d", null)],
      pages: [page("pg", ["a", "b", "c"], "two-over-one")],
    });
    useAlbum.getState().placeOnPage("d", "pg");
    expect(useAlbum.getState().pages[0].photoIds).toHaveLength(4);
    expect(layoutOf("pg")).toBe("four-row"); // 3-photo layout no longer valid
  });

  it("removeFromPage across a count boundary re-syncs the layout", () => {
    useAlbum.setState({
      photos: [photo("a", "pg"), photo("b", "pg"), photo("c", "pg")],
      pages: [page("pg", ["a", "b", "c"], "one-beside-two")],
    });
    useAlbum.getState().removeFromPage("c");
    expect(useAlbum.getState().pages[0].photoIds).toHaveLength(2);
    expect(layoutOf("pg")).toBe("two-row");
  });
});
