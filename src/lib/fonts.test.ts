import { describe, expect, it } from "vitest";
import { allShippedFaces, hasItalic, shippedFontById, shippedFontFace, supportedText, SHIPPED_FONTS } from "./fonts";

describe("the shipped font catalog", () => {
  it("ships seven families, each with a unique id, a name and a stack", () => {
    expect(SHIPPED_FONTS).toHaveLength(7);
    expect(new Set(SHIPPED_FONTS.map((f) => f.id)).size).toBe(7);
    for (const font of SHIPPED_FONTS) {
      expect(font.name.length).toBeGreaterThan(0);
      expect(font.stack).toContain(",");
    }
  });

  it("ships Cabin with its three faces, the humanist voice of the album (spec 040)", () => {
    const cabin = shippedFontById("cabin");
    expect(cabin.id).toBe("cabin");
    expect(cabin.faces.regular).toBeDefined();
    expect(cabin.faces.italic).toBeDefined();
    expect(cabin.faces.bold).toBeDefined();
  });

  it("gives every face a real asset url, since the PDF embeds the same file", () => {
    const faces = allShippedFaces();
    expect(faces.length).toBeGreaterThanOrEqual(6);
    for (const { face } of faces) {
      expect(typeof face.assetUrl).toBe("string");
      expect(face.assetUrl.length).toBeGreaterThan(0);
    }
  });

  it("falls back to the default family for an unknown or missing id", () => {
    expect(shippedFontById("comic-sans").id).toBe("garamond");
    expect(shippedFontById(undefined).id).toBe("garamond");
  });
});

describe("shippedFontFace", () => {
  it("resolves a shipped face for every family and every style combination", () => {
    for (const font of SHIPPED_FONTS) {
      for (const opts of [{}, { bold: true }, { italic: true }, { bold: true, italic: true }]) {
        const face = shippedFontFace(font.id, opts);
        const shipped = Object.values(font.faces);
        expect(shipped).toContain(face);
      }
    }
  });

  it("never synthesizes an oblique: a family with no italic falls back to a real face", () => {
    for (const font of SHIPPED_FONTS) {
      if (font.faces.italic) continue;
      expect(hasItalic(font.id)).toBe(false);
      expect(shippedFontFace(font.id, { italic: true })).toBe(font.faces.regular);
      expect(shippedFontFace(font.id, { bold: true, italic: true })).toBe(
        font.faces.bold ?? font.faces.regular,
      );
    }
  });

  it("reports italic support for the families that ship one", () => {
    expect(hasItalic("garamond")).toBe(true);
    expect(hasItalic("quicksand")).toBe(false);
    expect(hasItalic("caveat")).toBe(false);
  });

  it("picks the bold face when bold is asked for", () => {
    for (const font of SHIPPED_FONTS) {
      if (!font.faces.bold) continue;
      expect(shippedFontFace(font.id, { bold: true })).toBe(font.faces.bold);
      expect(shippedFontFace(font.id, { bold: true }).weight).toBe(700);
    }
  });
});

describe("supportedText", () => {
  // A face that has plain ASCII and nothing else, which is what the filter is for: an
  // embedded TrueType face paints an unmapped code point as a visible .notdef box.
  const ascii = (cp: number) => cp < 128;

  it("keeps everything a face can draw", () => {
    expect(supportedText("Le dernier soir", ascii)).toBe("Le dernier soir");
  });

  it("drops what it cannot, and only that", () => {
    expect(supportedText("Plage 🏖 2026", ascii)).toBe("Plage  2026");
    expect(supportedText("Été", ascii)).toBe("t");
  });

  it("keeps a plain space even when the predicate refuses everything", () => {
    expect(supportedText("a b", () => false)).toBe(" ");
  });

  it("treats an astral character as one character, not two halves", () => {
    // A naive per-code-unit filter would keep half a surrogate pair and corrupt the string.
    expect(supportedText("a🏖b", ascii)).toBe("ab");
    expect(supportedText("a🏖b", () => true)).toBe("a🏖b");
  });

  it("returns an empty string when nothing survives", () => {
    expect(supportedText("🏖🏖", ascii)).toBe("");
    expect(supportedText("", ascii)).toBe("");
  });
});
