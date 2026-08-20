import { describe, it, expect } from "vitest";
import {
  bookSizeOfDoc,
  cleanCover,
  coverOrDefault,
  duplicateDoc,
  effectiveSpineTitle,
  hydratePhotos,
  metaOf,
  newCover,
  newProjectDoc,
  serializeProject,
  spineOfDoc,
  type ProjectDoc,
  type ProjectState,
} from "./project";
import type { Cover, Photo } from "../types";

const photo = (id: string, ratio: number): Photo => ({
  id,
  url: `blob:${id}`,
  w: Math.round(ratio * 100),
  h: 100,
  ratio,
  time: 0,
  name: id,
  caption: `cap-${id}`,
});

const state = (): ProjectState => ({
  id: "proj-1",
  name: "Trip",
  createdAt: 1000,
  bookSize: "blurb-landscape-10x8",
  spine: { title: "On the spine" },
  fontTheme: "sans",
  colorTheme: "warm",
  textSizes: {
    coverTitle: "xl",
    coverSubtitle: "md",
    pageTitle: "lg",
    pageSubtitle: "sm",
    caption: "sm",
  },
  photos: [photo("a", 1.5), photo("b", 2 / 3)],
  pages: [
    { id: "pg", title: "Day 1", subtitle: "morning", photoIds: ["a", "b"], whitespace: 4, layoutId: "two-row" },
  ],
  frontCover: { title: "Our Trip", subtitle: "2026", photoId: "a", whitespace: 4 },
  insideFrontCover: { title: "For everyone", subtitle: "", photoId: "b", whitespace: 4 },
  insideBackCover: { title: "", subtitle: "", photoId: null, whitespace: 4 },
  backCover: { title: "The end", subtitle: "", photoId: null, whitespace: 4 },
});

describe("serializeProject", () => {
  it("strips the runtime url from every photo", () => {
    const doc = serializeProject(state(), 2000);
    for (const p of doc.photos) {
      expect("url" in p).toBe(false);
    }
  });

  it("stamps updatedAt and keeps id/name/createdAt/bookSize/spine", () => {
    const doc = serializeProject(state(), 2000);
    expect(doc).toMatchObject({
      id: "proj-1",
      name: "Trip",
      createdAt: 1000,
      updatedAt: 2000,
      bookSize: "blurb-landscape-10x8",
      spine: { title: "On the spine" },
    });
  });

  it("carries the font and color theme", () => {
    const doc = serializeProject(state(), 2000);
    expect(doc.fontTheme).toBe("sans");
    expect(doc.colorTheme).toBe("warm");
  });

  it("carries the per-role text sizes", () => {
    const doc = serializeProject(state(), 2000);
    expect(doc.textSizes).toEqual({
      coverTitle: "xl",
      coverSubtitle: "md",
      pageTitle: "lg",
      pageSubtitle: "sm",
      caption: "sm",
    });
  });

  it("carries the page subtitle", () => {
    const doc = serializeProject(state(), 2000);
    expect(doc.pages[0].subtitle).toBe("morning");
  });

  it("carries the book size and spine", () => {
    const doc = serializeProject(state(), 2000);
    expect(doc.bookSize).toBe("blurb-landscape-10x8");
    expect(doc.spine).toEqual({ title: "On the spine" });
  });

  it("round-trips pages, photo ids, ratios and captions through hydrate", () => {
    const doc = serializeProject(state(), 2000);
    const photos = hydratePhotos(doc, (id) => `blob:${id}`);
    expect(photos.map((p) => p.id)).toEqual(["a", "b"]);
    expect(photos.map((p) => p.ratio)).toEqual([1.5, 2 / 3]);
    expect(photos.map((p) => p.caption)).toEqual(["cap-a", "cap-b"]);
    expect(photos.every((p) => p.url.startsWith("blob:"))).toBe(true);
    expect(doc.pages[0]).toMatchObject({ photoIds: ["a", "b"], layoutId: "two-row" });
  });

  it("does not alias the source page arrays", () => {
    const s = state();
    const doc = serializeProject(s, 2000);
    doc.pages[0].photoIds.push("c");
    expect(s.pages[0].photoIds).toEqual(["a", "b"]);
  });
});

describe("hydratePhotos", () => {
  it("drops a photo whose blob is missing (urlFor returns undefined)", () => {
    const doc = serializeProject(state(), 2000);
    const photos = hydratePhotos(doc, (id) => (id === "a" ? "blob:a" : undefined));
    expect(photos.map((p) => p.id)).toEqual(["a"]);
  });
});

describe("newProjectDoc", () => {
  it("creates an id, the given name, timestamps and no pages yet", () => {
    const doc = newProjectDoc("Fresh", 500);
    expect(typeof doc.id).toBe("string");
    expect(doc.name).toBe("Fresh");
    expect(doc.createdAt).toBe(500);
    expect(doc.updatedAt).toBe(500);
    expect(doc.photos).toEqual([]);
    expect(doc.pages).toEqual([]);
  });

  it("starts with the default font, color theme and text sizes", () => {
    const doc = newProjectDoc("Fresh", 500);
    expect(doc.fontTheme).toBe("serif");
    expect(doc.colorTheme).toBe("classic");
    expect(doc.textSizes).toEqual({
      coverTitle: "md",
      coverSubtitle: "md",
      pageTitle: "md",
      pageSubtitle: "md",
      caption: "md",
    });
  });

  it("starts with the default book size and an empty (auto) spine", () => {
    const doc = newProjectDoc("Fresh", 500);
    expect(doc.bookSize).toBe("blurb-square-7");
    expect(doc.spine).toEqual({ title: "" });
  });
});

describe("book size + spine migration", () => {
  it("migrates a legacy doc's format to a Blurb size and defaults the spine", () => {
    const legacy = {
      ...serializeProject(state(), 2000),
      bookSize: undefined,
      spine: undefined,
      format: "portrait",
    } as unknown as ProjectDoc;
    expect(bookSizeOfDoc(legacy)).toBe("blurb-portrait-8x10");
    expect(spineOfDoc(legacy)).toEqual({ title: "" });
  });

  it("keeps an explicit bookSize and spine when present", () => {
    const doc = serializeProject(state(), 2000);
    expect(bookSizeOfDoc(doc)).toBe("blurb-landscape-10x8");
    expect(spineOfDoc(doc)).toEqual({ title: "On the spine" });
  });

  it("effectiveSpineTitle prefers the override, then cover title, then album name, else empty", () => {
    const cover: Cover = { title: "Summer", subtitle: "", photoId: null, whitespace: 4 };
    const blank: Cover = { ...cover, title: "" };
    expect(effectiveSpineTitle({ title: "Custom" }, cover, "My Album")).toBe("Custom");
    expect(effectiveSpineTitle({ title: "  " }, cover, "My Album")).toBe("Summer");
    // No override and no cover title -> fall back to the album (project) name.
    expect(effectiveSpineTitle({ title: "" }, blank, "My Album")).toBe("My Album");
    expect(effectiveSpineTitle({ title: "" }, blank, "  ")).toBe("");
    expect(effectiveSpineTitle({ title: "" }, blank)).toBe(""); // albumName optional
  });
});

describe("duplicateDoc", () => {
  it("copies under a new id and name, remapping photo ids and stamping timestamps", () => {
    const src: ProjectDoc = serializeProject(state(), 2000);
    const map = new Map([
      ["a", "a2"],
      ["b", "b2"],
    ]);
    const dup = duplicateDoc(src, { id: "proj-2", name: "Trip copy", now: 3000, photoIdMap: map });
    expect(dup.id).toBe("proj-2");
    expect(dup.name).toBe("Trip copy");
    expect(dup.createdAt).toBe(3000);
    expect(dup.updatedAt).toBe(3000);
    expect(dup.photos.map((p) => p.id)).toEqual(["a2", "b2"]);
    expect(dup.pages[0].photoIds).toEqual(["a2", "b2"]);
    // source untouched
    expect(src.photos.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("carries the font, color theme and text sizes into the copy", () => {
    const src: ProjectDoc = serializeProject(state(), 2000);
    const dup = duplicateDoc(src, { id: "p2", name: "copy", now: 3000, photoIdMap: new Map() });
    expect(dup.fontTheme).toBe("sans");
    expect(dup.colorTheme).toBe("warm");
    expect(dup.textSizes).toEqual({
      coverTitle: "xl",
      coverSubtitle: "md",
      pageTitle: "lg",
      pageSubtitle: "sm",
      caption: "sm",
    });
    expect(dup.pages[0].subtitle).toBe("morning");
  });

  it("carries the book size and spine into the copy", () => {
    const src: ProjectDoc = serializeProject(state(), 2000);
    const dup = duplicateDoc(src, { id: "p2", name: "copy", now: 3000, photoIdMap: new Map() });
    expect(dup.bookSize).toBe("blurb-landscape-10x8");
    expect(dup.spine).toEqual({ title: "On the spine" });
  });
});

describe("metaOf", () => {
  it("returns only the meta fields", () => {
    const doc = serializeProject(state(), 2000);
    expect(metaOf(doc)).toEqual({ id: "proj-1", name: "Trip", createdAt: 1000, updatedAt: 2000 });
  });
});

describe("covers", () => {
  it("newProjectDoc starts with four empty covers", () => {
    const doc = newProjectDoc("Fresh", 500);
    expect(doc.frontCover).toEqual(newCover());
    expect(doc.insideFrontCover).toEqual(newCover());
    expect(doc.insideBackCover).toEqual(newCover());
    expect(doc.backCover).toEqual(newCover());
    expect(newCover().photoId).toBeNull();
  });

  it("serializeProject carries all four covers through", () => {
    const doc = serializeProject(state(), 2000);
    expect(doc.frontCover).toEqual({ title: "Our Trip", subtitle: "2026", photoId: "a", whitespace: 4 });
    expect(doc.insideFrontCover).toEqual({ title: "For everyone", subtitle: "", photoId: "b", whitespace: 4 });
    expect(doc.backCover).toEqual({ title: "The end", subtitle: "", photoId: null, whitespace: 4 });
  });

  it("serializeProject does not alias the source covers", () => {
    const s = state();
    const doc = serializeProject(s, 2000);
    doc.frontCover.title = "changed";
    expect(s.frontCover.title).toBe("Our Trip");
  });

  it("duplicateDoc remaps cover photo ids through the map", () => {
    const src: ProjectDoc = serializeProject(state(), 2000);
    const map = new Map([
      ["a", "a2"],
      ["b", "b2"],
    ]);
    const dup = duplicateDoc(src, { id: "p2", name: "copy", now: 3000, photoIdMap: map });
    expect(dup.frontCover.photoId).toBe("a2"); // was "a"
    expect(dup.insideFrontCover.photoId).toBe("b2"); // was "b"
    expect(dup.backCover.photoId).toBeNull(); // stays null
  });

  it("coverOrDefault fills a missing cover (backward compat)", () => {
    expect(coverOrDefault(undefined)).toEqual(newCover());
    expect(coverOrDefault(null)).toEqual(newCover());
    const partial = { title: "Hi" } as unknown as Cover;
    expect(coverOrDefault(partial)).toEqual({ ...newCover(), title: "Hi" });
  });

  it("cleanCover nulls a photoId whose photo is gone, keeping text", () => {
    const cover: Cover = { title: "T", subtitle: "S", photoId: "gone", whitespace: 4 };
    const cleaned = cleanCover(cover, new Set(["a", "b"]));
    expect(cleaned.photoId).toBeNull();
    expect(cleaned.title).toBe("T");
    const kept = cleanCover({ ...cover, photoId: "a" }, new Set(["a"]));
    expect(kept.photoId).toBe("a");
  });
});
