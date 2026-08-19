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

describe("interiorPageGeometry - full page (spec 012)", () => {
  const pageRatio = trimW / trimH; // portrait 8x10 -> < 1

  it("contain: maximizes one photo inside the media box, ratio intact, no text", () => {
    const g = interiorPageGeometry(
      pageInput([{ photoId: "a", ratio: 1.5, caption: "cap" }], "single", {
        fullPage: "contain",
        title: "T",
        subtitle: "S",
      }),
    );
    expect(g.photos).toHaveLength(1);
    const p = g.photos[0];
    expect(p.w / p.h).toBeCloseTo(1.5, 6); // ratio preserved
    expect(p.cover).toBeFalsy();
    // Inside the media box (into the bleed), never overflowing.
    expect(p.x).toBeGreaterThanOrEqual(-1e-6);
    expect(p.y).toBeGreaterThanOrEqual(-1e-6);
    expect(p.x + p.w).toBeLessThanOrEqual(g.mediaBox.w + 1e-6);
    expect(p.y + p.h).toBeLessThanOrEqual(g.mediaBox.h + 1e-6);
    // Maximized: it touches a media-box edge on its constraining axis.
    const touchesW = Math.abs(p.w - g.mediaBox.w) < 1e-6;
    const touchesH = Math.abs(p.h - g.mediaBox.h) < 1e-6;
    expect(touchesW || touchesH).toBe(true);
    // No page text in full-page mode.
    expect(g.title).toBeNull();
    expect(g.subtitle).toBeNull();
    expect(g.captions).toHaveLength(0);
  });

  it("contain: a photo matching the page ratio covers the full trim (true bleed)", () => {
    const g = interiorPageGeometry(
      pageInput([{ photoId: "a", ratio: pageRatio, caption: "" }], "single", { fullPage: "contain" }),
    );
    const p = g.photos[0];
    expect(p.w / p.h).toBeCloseTo(pageRatio, 6); // ratio preserved
    // It reaches into the bleed (touches a media-box edge) and fully covers the trim, so
    // the trimmed book shows no paper band. (The tiny slack sits in the bleed.)
    const t = g.trimBox;
    expect(p.x).toBeLessThanOrEqual(t.x + 1e-6);
    expect(p.y).toBeLessThanOrEqual(t.y + 1e-6);
    expect(p.x + p.w).toBeGreaterThanOrEqual(t.x + t.w - 1e-6);
    expect(p.y + p.h).toBeGreaterThanOrEqual(t.y + t.h - 1e-6);
  });

  it("cover: the photo box is the whole media box, flagged cover, carrying the focus", () => {
    const focus = { x: 0.2, y: 0.8 };
    const g = interiorPageGeometry(
      pageInput([{ photoId: "a", ratio: 2, caption: "" }], "single", { fullPage: "cover", focus }),
    );
    const p = g.photos[0];
    expect(p).toMatchObject({ x: 0, y: 0, cover: true, focus });
    expect(p.w).toBeCloseTo(g.mediaBox.w, 5);
    expect(p.h).toBeCloseTo(g.mediaBox.h, 5);
    expect(g.title).toBeNull();
    expect(g.captions).toHaveLength(0);
  });

  it("cover: defaults the focus to centered when none is given", () => {
    const g = interiorPageGeometry(
      pageInput([{ photoId: "a", ratio: 2, caption: "" }], "single", { fullPage: "cover" }),
    );
    expect(g.photos[0].focus).toEqual({ x: 0.5, y: 0.5 });
  });

  it("ignores full page unless there is exactly one photo", () => {
    const items = [
      { photoId: "a", ratio: 1, caption: "" },
      { photoId: "b", ratio: 1, caption: "" },
    ];
    const g = interiorPageGeometry(pageInput(items, "two-row", { fullPage: "cover" }));
    // Falls back to the normal two-photo layout inside the trim content box.
    expect(g.photos).toHaveLength(2);
    expect(g.photos.every((p) => !p.cover)).toBe(true);
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

  it("keeps the cover photo size independent of the title font size (fixed top band)", () => {
    const base = { size, spineWidthPt: mmToPt(8), back: face(null), spineTitle: "", spineSubtitle: "" };
    const small = coverWrapGeometry({ ...base, front: face("f"), scales: { coverTitle: 0.85, coverSubtitle: 1 } });
    const large = coverWrapGeometry({ ...base, front: face("f"), scales: { coverTitle: 1.45, coverSubtitle: 1 } });
    // The title grows from S to XL, but the photo box does not move or shrink.
    expect(large.front.photo!.h).toBeCloseTo(small.front.photo!.h, 5);
    expect(large.front.photo!.w).toBeCloseTo(small.front.photo!.w, 5);
    expect(large.front.photo!.y).toBeCloseTo(small.front.photo!.y, 5);
  });

  it("gives a subtitle-less cover a larger photo, at every font size", () => {
    const titled = (subtitle: string) => ({
      title: "Summer",
      subtitle,
      photo: { photoId: "f", ratio: 0.7 }, // portrait: bound by the band height
      whitespace: 4,
    });
    for (const coverTitle of [0.85, 1, 1.45]) {
      const base = { size, spineWidthPt: mmToPt(8), back: face(null), spineTitle: "", spineSubtitle: "", scales: { coverTitle, coverSubtitle: 1 } };
      const withSub = coverWrapGeometry({ ...base, front: titled("2026") });
      const noSub = coverWrapGeometry({ ...base, front: titled("") });
      expect(noSub.front.photo!.h).toBeGreaterThan(withSub.front.photo!.h);
    }
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
