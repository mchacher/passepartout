import { describe, it, expect } from "vitest";
import {
  blankLeaf,
  dropEmptyInsideCovers,
  insideCoverIsEmpty,
  padInterior,
  type ExportPageLike,
} from "./pdf-export";
import { BLURB } from "./provider-blurb";

// Blurb refuses an odd page count outright ("Le nombre de pages doit etre un multiple de 2"),
// and when you let its uploader fix it, it appends the blank sheet at the very end, after the
// page that closes the book (issue #114).
const leaf = (title: string): ExportPageLike => ({
  title,
  subtitle: "",
  whitespace: 4,
  layoutId: "single",
  items: [],
});

const insideCover = (title = ""): ExportPageLike => ({ ...leaf(title), insideCover: true });

/** `n` content pages, numbered, between the two inside cover faces. */
const book = (n: number): ExportPageLike[] => [
  insideCover("inside front"),
  ...Array.from({ length: n }, (_, i) => leaf(String(i + 1))),
  insideCover("inside back"),
];

const blurb = BLURB.pageCount; // { multipleOf: 2, min: 20, max: 440 }

describe("padInterior", () => {
  it("leaves an acceptable count alone", () => {
    const pages = book(24); // 26 leaves, even and above the minimum
    expect(padInterior(pages, blurb)).toBe(pages);
  });

  it("pads an odd interior to an even count", () => {
    const pages = book(23); // 25 leaves, which is what Blurb rejected
    const out = padInterior(pages, blurb);
    expect(out).toHaveLength(26);
  });

  it("puts the blank leaf before the inside cover that closes the book", () => {
    const pages = book(23);
    const out = padInterior(pages, blurb);
    expect(out.at(-1)!.title).toBe("inside back");
    expect(out.at(-2)!.title).toBe("");
    expect(out.at(-3)!.title).toBe("23");
  });

  it("puts it at the very end when no inside cover closes the block", () => {
    // What an album with a blank inside back cover looks like once it has been dropped (#117).
    const pages = [insideCover("inside front"), ...Array.from({ length: 24 }, (_, i) => leaf(String(i + 1)))];
    const out = padInterior(pages, blurb);
    expect(out).toHaveLength(26);
    expect(out.at(-1)!.title).toBe("");
    expect(out.at(-2)!.title).toBe("24");
  });

  // The multiple alone let a short album export at a count Blurb refuses outright, with only a
  // warning in the panel to say so.
  it("raises a short album to the printer's minimum", () => {
    expect(padInterior(book(10), blurb)).toHaveLength(20); // 12 leaves -> 20
    expect(padInterior(book(5), blurb)).toHaveLength(20);
  });

  it("makes a blank leaf that prints nothing", () => {
    const b = blankLeaf();
    expect(b.items).toHaveLength(0);
    expect(b.title).toBe("");
    expect(b.subtitle).toBe("");
    expect(b.notes).toBeUndefined();
  });
});

// An inside cover face is the first and the last printed sheet of the block. Left blank it
// still costs a page at each end, which is how an album of 23 pages reached Blurb as 26 with
// three empty ones (#117).
describe("dropEmptyInsideCovers", () => {
  it("drops a face with nothing on it, at either end", () => {
    // The Corse 2026 album: 23 pages between two inside cover faces the author never filled.
    const pages = [insideCover(), leaf("1"), leaf("2"), leaf("3"), insideCover()];
    expect(dropEmptyInsideCovers(pages).map((p) => p.title)).toEqual(["1", "2", "3"]);
  });

  it("keeps a face carrying a title, a photo or a note", () => {
    const withTitle = [insideCover("A dedication"), leaf("1")];
    expect(dropEmptyInsideCovers(withTitle)).toHaveLength(2);

    const withPhoto: ExportPageLike[] = [
      { ...insideCover(), items: [{ photoId: "p", ratio: 1.5, photoRatio: 1.5, sourceRatio: 1.5, caption: "", url: "blob:x" }] },
      leaf("1"),
    ];
    expect(dropEmptyInsideCovers(withPhoto)).toHaveLength(2);

    const withNote: ExportPageLike[] = [
      {
        ...insideCover(),
        notes: [
          {
            id: "n",
            text: "For Ana",
            x: 0.5,
            y: 0.5,
            w: 0.4,
            size: "md",
            font: "lato",
            align: "center",
            ink: "ink",
            caps: false,
          },
        ],
      },
      leaf("1"),
    ];
    expect(dropEmptyInsideCovers(withNote)).toHaveLength(2);
  });

  it("never drops an ordinary page, however empty", () => {
    const pages = [insideCover(), leaf(""), insideCover()];
    expect(dropEmptyInsideCovers(pages)).toHaveLength(1);
    expect(dropEmptyInsideCovers(pages)[0].insideCover).toBeUndefined();
  });

  it("treats whitespace-only text as empty", () => {
    expect(insideCoverIsEmpty(insideCover("   "))).toBe(true);
    expect(insideCoverIsEmpty(insideCover("Corse"))).toBe(false);
  });
});
