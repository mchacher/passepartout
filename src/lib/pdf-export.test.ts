import { describe, it, expect } from "vitest";
import { blankLeaf, evenInterior, type ExportPageLike } from "./pdf-export";

// Blurb refuses an odd page count outright ("Le nombre de pages doit etre un multiple de 2"),
// and when you let its uploader fix it, it appends the blank sheet after the inside back
// cover, which is not where a book should end (issue #114).
const leaf = (title: string): ExportPageLike => ({
  title,
  subtitle: "",
  whitespace: 4,
  layoutId: "single",
  items: [],
});

describe("evenInterior", () => {
  it("leaves an even interior alone", () => {
    const pages = [leaf("inside front"), leaf("1"), leaf("2"), leaf("inside back")];
    expect(evenInterior(pages)).toBe(pages);
  });

  it("pads an odd interior to an even count", () => {
    const pages = [leaf("inside front"), leaf("1"), leaf("inside back")];
    const out = evenInterior(pages);
    expect(out).toHaveLength(4);
    expect(out.length % 2).toBe(0);
  });

  it("puts the blank leaf just before the inside back cover", () => {
    const pages = [leaf("inside front"), leaf("1"), leaf("2"), leaf("3"), leaf("inside back")];
    const out = evenInterior(pages);
    expect(out.map((p) => p.title)).toEqual(["inside front", "1", "2", "3", "", "inside back"]);
  });

  it("makes a blank leaf that prints nothing", () => {
    const b = blankLeaf();
    expect(b.items).toHaveLength(0);
    expect(b.title).toBe("");
    expect(b.subtitle).toBe("");
    expect(b.notes).toBeUndefined();
  });
});
