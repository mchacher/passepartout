import { describe, it, expect } from "vitest";
import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { buildBundle, parseBundle, BundleError, BUNDLE_FORMAT, BUNDLE_VERSION, type BundleImage } from "./bundle";
import { newProjectDoc, type ProjectDoc, type StoredPhoto } from "./project";

const photo = (id: string): StoredPhoto => ({
  id,
  w: 1200,
  h: 800,
  ratio: 1.5,
  time: 1000,
  name: `${id}.jpg`,
  caption: "",
});

function docWithPhotos(ids: string[]): ProjectDoc {
  const doc = newProjectDoc("Trip", 1234);
  doc.photos = ids.map(photo);
  doc.pages = [{ id: "pg1", title: "", subtitle: "", photoIds: [...ids], whitespace: 1, layoutId: "single" }];
  return doc;
}

const img = (bytes: number[], mime = "image/jpeg"): BundleImage => ({ bytes: new Uint8Array(bytes), mime });

describe("buildBundle / parseBundle", () => {
  it("round-trips the doc and every image, byte for byte", () => {
    const doc = docWithPhotos(["a", "b"]);
    const images = new Map([
      ["a", img([1, 2, 3, 4, 5])],
      ["b", img([255, 0, 128], "image/png")],
    ]);
    const bytes = buildBundle(doc, images, 999);
    const parsed = parseBundle(bytes);

    expect(parsed.doc).toEqual(doc);
    expect(parsed.exportedAt).toBe(999);
    expect([...parsed.images.get("a")!.bytes]).toEqual([1, 2, 3, 4, 5]);
    expect(parsed.images.get("a")!.mime).toBe("image/jpeg");
    expect([...parsed.images.get("b")!.bytes]).toEqual([255, 0, 128]);
    expect(parsed.images.get("b")!.mime).toBe("image/png");
  });

  it("carries the format tag, version and export time in the manifest", () => {
    const bytes = buildBundle(docWithPhotos([]), new Map(), 42);
    // Peek at the raw manifest to assert its shape.
    const manifest = JSON.parse(strFromU8(unzipSync(bytes)["album.json"]));
    expect(manifest.format).toBe(BUNDLE_FORMAT);
    expect(manifest.version).toBe(BUNDLE_VERSION);
    expect(manifest.exportedAt).toBe(42);
  });

  it("tolerates a photo record with no image blob (id simply absent from images)", () => {
    const doc = docWithPhotos(["a", "b"]);
    const images = new Map([["a", img([9])]]); // b has no blob
    const parsed = parseBundle(buildBundle(doc, images, 1));
    expect(parsed.images.has("a")).toBe(true);
    expect(parsed.images.has("b")).toBe(false);
    expect(parsed.doc.photos.map((p) => p.id)).toEqual(["a", "b"]); // doc unchanged
  });

  it("throws BundleError on non-zip bytes", () => {
    expect(() => parseBundle(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toThrow(BundleError);
  });

  it("throws BundleError on a zip without album.json", () => {
    const zip = zipSync({ "images/a": new Uint8Array([1]) });
    expect(() => parseBundle(zip)).toThrow(/not a Passepartout album bundle/i);
  });

  it("throws BundleError when the format tag is wrong", () => {
    const zip = zipSync({ "album.json": strToU8(JSON.stringify({ format: "something-else", version: 1, doc: {} })) });
    expect(() => parseBundle(zip)).toThrow(BundleError);
  });

  it("throws BundleError on a manifest from a newer version", () => {
    const zip = zipSync({
      "album.json": strToU8(JSON.stringify({ format: BUNDLE_FORMAT, version: BUNDLE_VERSION + 1, doc: {}, imageMime: {} })),
    });
    expect(() => parseBundle(zip)).toThrow(/newer version/i);
  });

  it("throws BundleError when the manifest has no doc", () => {
    const zip = zipSync({ "album.json": strToU8(JSON.stringify({ format: BUNDLE_FORMAT, version: 1, imageMime: {} })) });
    expect(() => parseBundle(zip)).toThrow(BundleError);
  });
});
