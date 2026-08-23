import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import {
  clearAll,
  copyImage,
  deleteProject,
  deleteImage,
  getImage,
  listImageIds,
  listProjects,
  loadProjectDoc,
  putImage,
  saveProjectDoc,
} from "./persistence";
import { newProjectDoc, type ProjectDoc } from "./lib/project";

const docWithPhoto = (id: string, name: string, at: number, photoId: string): ProjectDoc => ({
  ...newProjectDoc(name, at),
  id,
  photos: [
    { id: photoId, w: 100, h: 100, ratio: 1, time: 0, name: photoId, caption: "" },
  ],
});

beforeEach(async () => {
  await clearAll();
});

describe("image ids (spec 037)", () => {
  it("lists exactly the stored keys, and follows writes and deletes", async () => {
    expect(await listImageIds()).toEqual([]);
    await putImage("img-a", new Blob([new Uint8Array([1])]));
    await putImage("img-b", new Blob([new Uint8Array([2])]));
    expect((await listImageIds()).sort()).toEqual(["img-a", "img-b"]);

    // The sweep deletes through this same pair, so the listing has to reflect a delete.
    await deleteImage("img-a");
    expect(await listImageIds()).toEqual(["img-b"]);
    expect(await getImage("img-a")).toBeUndefined();
    expect(await getImage("img-b")).toBeDefined();
  });

  it("does not confuse an image with a project", async () => {
    await saveProjectDoc(docWithPhoto("p1", "Trip", 1000, "img-1"));
    expect(await listImageIds()).toEqual([]); // a doc mentioning a photo stores no bytes
  });
});

describe("persistence adapter", () => {
  it("round-trips a project doc", async () => {
    const doc = docWithPhoto("p1", "Trip", 1000, "img-1");
    await saveProjectDoc(doc);
    const back = await loadProjectDoc("p1");
    expect(back).toEqual(doc);
  });

  it("returns undefined for a missing project (no throw)", async () => {
    await expect(loadProjectDoc("nope")).resolves.toBeUndefined();
    await expect(getImage("nope")).resolves.toBeUndefined();
  });

  it("stores and reads back an image blob unchanged", async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: "image/jpeg" });
    await putImage("img-1", blob);
    const back = await getImage("img-1");
    expect(back).toBeInstanceOf(Blob);
    expect(back!.size).toBe(5);
    expect(back!.type).toBe("image/jpeg");
  });

  it("lists project metas newest first", async () => {
    await saveProjectDoc(docWithPhoto("a", "A", 1000, "ia"));
    await saveProjectDoc(docWithPhoto("b", "B", 3000, "ib"));
    await saveProjectDoc(docWithPhoto("c", "C", 2000, "ic"));
    const metas = await listProjects();
    expect(metas.map((m) => m.id)).toEqual(["b", "c", "a"]);
    // metas carry no pages/photos
    expect(metas.every((m) => !("photos" in m))).toBe(true);
  });

  it("deletes a project doc and its image blobs together", async () => {
    const doc = docWithPhoto("p1", "Trip", 1000, "img-1");
    await saveProjectDoc(doc);
    await putImage("img-1", new Blob(["x"]));
    await deleteProject("p1");
    expect(await loadProjectDoc("p1")).toBeUndefined();
    expect(await getImage("img-1")).toBeUndefined();
  });

  it("copyImage duplicates a blob under a new id", async () => {
    await putImage("src", new Blob([new Uint8Array([9, 9])], { type: "image/png" }));
    await copyImage("src", "dst");
    const back = await getImage("dst");
    expect(back!.size).toBe(2);
    expect(back!.type).toBe("image/png");
  });
});
