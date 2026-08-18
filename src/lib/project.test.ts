import { describe, it, expect } from "vitest";
import {
  duplicateDoc,
  hydratePhotos,
  metaOf,
  newProjectDoc,
  serializeProject,
  type ProjectDoc,
  type ProjectState,
} from "./project";
import type { Photo } from "../types";

const photo = (id: string, ratio: number, pageId: string | null = null): Photo => ({
  id,
  url: `blob:${id}`,
  w: Math.round(ratio * 100),
  h: 100,
  ratio,
  time: 0,
  name: id,
  caption: `cap-${id}`,
  pageId,
});

const state = (): ProjectState => ({
  id: "proj-1",
  name: "Trip",
  createdAt: 1000,
  format: "landscape",
  photos: [photo("a", 1.5, "pg"), photo("b", 2 / 3, "pg")],
  pages: [
    { id: "pg", title: "Day 1", photoIds: ["a", "b"], whitespace: 4, layoutId: "two-row" },
  ],
});

describe("serializeProject", () => {
  it("strips the runtime url from every photo", () => {
    const doc = serializeProject(state(), 2000);
    for (const p of doc.photos) {
      expect("url" in p).toBe(false);
    }
  });

  it("stamps updatedAt and keeps id/name/createdAt/format", () => {
    const doc = serializeProject(state(), 2000);
    expect(doc).toMatchObject({
      id: "proj-1",
      name: "Trip",
      createdAt: 1000,
      updatedAt: 2000,
      format: "landscape",
    });
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
});

describe("metaOf", () => {
  it("returns only the meta fields", () => {
    const doc = serializeProject(state(), 2000);
    expect(metaOf(doc)).toEqual({ id: "proj-1", name: "Trip", createdAt: 1000, updatedAt: 2000 });
  });
});
