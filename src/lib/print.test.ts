import { describe, it, expect } from "vitest";
import { bookSizeOrDefault, BLEED_MM } from "./book-sizes";
import {
  coverWrapGeometry,
  estimateSpineMm,
  fontFamilyForTheme,
  interiorPageGeometry,
  mmToPt,
  SPINE_COVER_MM,
  type PageInput,
} from "./print";

const size = bookSizeOrDefault("blurb-portrait-8x10");
const bleedPt = mmToPt(BLEED_MM);
const trimW = mmToPt(size.widthMm);
const trimH = mmToPt(size.heightMm);

const scales = { pageTitle: 1, pageSubtitle: 1, caption: 1 };

const pageInput = (items: PageInput["items"], layoutId: string, extra?: Partial<PageInput>): PageInput => ({
  size,
  items,
  layoutId,
  whitespace: 4,
  title: "",
  subtitle: "",
  scales,
  ...extra,
});

describe("interiorPageGeometry", () => {
  it("makes the media box the trim plus bleed on every side", () => {
    const g = interiorPageGeometry(pageInput([], "single"));
    expect(g.mediaBox.w).toBeCloseTo(trimW + 2 * bleedPt, 5);
    expect(g.mediaBox.h).toBeCloseTo(trimH + 2 * bleedPt, 5);
    expect(g.trimBox).toMatchObject({ x: bleedPt, y: bleedPt });
    expect(g.trimBox.w).toBeCloseTo(trimW, 5);
    expect(g.trimBox.h).toBeCloseTo(trimH, 5);
  });

  it("keeps the content box strictly inside the trim box", () => {
    const g = interiorPageGeometry(pageInput([], "single", { title: "Hi", subtitle: "there" }));
    expect(g.contentBox.x).toBeGreaterThan(g.trimBox.x);
    expect(g.contentBox.y).toBeGreaterThan(g.trimBox.y);
    expect(g.contentBox.x + g.contentBox.w).toBeLessThanOrEqual(g.trimBox.x + g.trimBox.w + 1e-6);
    expect(g.contentBox.y + g.contentBox.h).toBeLessThanOrEqual(g.trimBox.y + g.trimBox.h + 1e-6);
  });

  it("preserves every photo's ratio (never crops or stretches)", () => {
    const items = [
      { photoId: "a", ratio: 1.5, caption: "" },
      { photoId: "b", ratio: 2 / 3, caption: "" },
      { photoId: "c", ratio: 1, caption: "" },
    ];
    const g = interiorPageGeometry(pageInput(items, "three-row"));
    g.photos.forEach((p, i) => {
      expect(p.w / p.h).toBeCloseTo(items[i].ratio, 6);
    });
  });

  it("fits every photo inside the content box (no overflow)", () => {
    const items = [
      { photoId: "a", ratio: 1.5, caption: "" },
      { photoId: "b", ratio: 0.7, caption: "" },
    ];
    const g = interiorPageGeometry(pageInput(items, "two-row"));
    const c = g.contentBox;
    for (const p of g.photos) {
      expect(p.x).toBeGreaterThanOrEqual(c.x - 1e-6);
      expect(p.y).toBeGreaterThanOrEqual(c.y - 1e-6);
      expect(p.x + p.w).toBeLessThanOrEqual(c.x + c.w + 1e-6);
      expect(p.y + p.h).toBeLessThanOrEqual(c.y + c.h + 1e-6);
    }
  });

  it("scales a panorama to fit, ratio intact, no clip", () => {
    const g = interiorPageGeometry(pageInput([{ photoId: "pan", ratio: 4, caption: "" }], "single"));
    const p = g.photos[0];
    expect(p.w / p.h).toBeCloseTo(4, 6);
    expect(p.w).toBeLessThanOrEqual(g.contentBox.w + 1e-6);
    expect(p.h).toBeLessThanOrEqual(g.contentBox.h + 1e-6);
  });

  it("emits a caption only for photos that have one", () => {
    const items = [
      { photoId: "a", ratio: 1, caption: "hello" },
      { photoId: "b", ratio: 1, caption: "" },
    ];
    const g = interiorPageGeometry(pageInput(items, "two-row"));
    expect(g.captions).toHaveLength(1);
    expect(g.captions[0].text).toBe("hello");
  });
});

describe("coverWrapGeometry", () => {
  const face = (photoId: string | null) => ({
    title: "Summer",
    subtitle: "2026",
    photo: photoId ? { photoId, ratio: 1.5 } : null,
    whitespace: 4,
  });

  it("sizes the wrap as back + spine + front plus bleed", () => {
    const spine = mmToPt(8);
    const g = coverWrapGeometry({
      size,
      spineWidthPt: spine,
      front: face("f"),
      back: face(null),
      spineTitle: "Summer",
      spineSubtitle: "",
      scales: { coverTitle: 1, coverSubtitle: 1 },
    });
    expect(g.mediaBox.w).toBeCloseTo(2 * trimW + spine + 2 * bleedPt, 5);
    expect(g.mediaBox.h).toBeCloseTo(trimH + 2 * bleedPt, 5);
    // Panels sit left (back), middle (spine), right (front).
    expect(g.back.trimBox.x).toBeCloseTo(bleedPt, 5);
    expect(g.spineBox.x).toBeCloseTo(bleedPt + trimW, 5);
    expect(g.front.trimBox.x).toBeCloseTo(bleedPt + trimW + spine, 5);
    expect(g.spineBox.w).toBeCloseTo(spine, 5);
  });

  it("keeps the front cover photo's ratio and emits no spine line when title-less", () => {
    const g = coverWrapGeometry({
      size,
      spineWidthPt: mmToPt(8),
      front: face("f"),
      back: face(null),
      spineTitle: "",
      spineSubtitle: "",
      scales: { coverTitle: 1, coverSubtitle: 1 },
    });
    expect(g.front.photo).not.toBeNull();
    expect(g.front.photo!.w / g.front.photo!.h).toBeCloseTo(1.5, 6);
    expect(g.spineLines).toHaveLength(0);
  });

  it("puts the title alone, or title + subtitle, on the spine", () => {
    const base = { size, spineWidthPt: mmToPt(10), front: face(null), back: face(null), scales: { coverTitle: 1, coverSubtitle: 1 } };
    const titleOnly = coverWrapGeometry({ ...base, spineTitle: "Solio", spineSubtitle: "" });
    expect(titleOnly.spineLines.map((l) => l.text)).toEqual(["Solio"]);

    const both = coverWrapGeometry({ ...base, spineTitle: "Solio", spineSubtitle: "Ardeche" });
    expect(both.spineLines.map((l) => l.text)).toEqual(["Solio", "Ardeche"]);
    // Two parallel lines: distinct positions across the spine width, both inside it.
    expect(both.spineLines[0].cx).not.toBeCloseTo(both.spineLines[1].cx, 3);
    for (const l of both.spineLines) {
      expect(l.cx).toBeGreaterThan(both.spineBox.x);
      expect(l.cx).toBeLessThan(both.spineBox.x + both.spineBox.w);
    }
  });
});

describe("spine estimate + font mapping", () => {
  it("grows the spine estimate monotonically, plus a cover allowance", () => {
    // Even a 0-page book has a cover, so the estimate is never sub-millimetre.
    expect(estimateSpineMm(0, "standard")).toBe(SPINE_COVER_MM);
    expect(estimateSpineMm(40, "standard")).toBeGreaterThan(estimateSpineMm(20, "standard"));
    expect(estimateSpineMm(20, "standard")).toBeGreaterThan(SPINE_COVER_MM);
    expect(estimateSpineMm(20, "premium-lustre")).toBeGreaterThan(estimateSpineMm(20, "standard"));
    expect(estimateSpineMm(20, "nope")).toBe(estimateSpineMm(20, "standard")); // unknown -> default
  });

  it("maps each album font to a standard PDF family", () => {
    expect(fontFamilyForTheme("serif")).toBe("serif");
    expect(fontFamilyForTheme("typewriter")).toBe("mono");
    expect(fontFamilyForTheme("sans")).toBe("sans");
    expect(fontFamilyForTheme("humanist")).toBe("sans");
    expect(fontFamilyForTheme("rounded")).toBe("sans");
  });
});
