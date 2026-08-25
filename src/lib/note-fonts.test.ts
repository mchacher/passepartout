import { describe, expect, it } from "vitest";
import { allNoteFaces, hasItalic, noteFontById, noteFontFace, NOTE_FONTS } from "./note-fonts";

describe("the note font catalog", () => {
  it("ships six families, each with a unique id, a name and a stack", () => {
    expect(NOTE_FONTS).toHaveLength(6);
    expect(new Set(NOTE_FONTS.map((f) => f.id)).size).toBe(6);
    for (const font of NOTE_FONTS) {
      expect(font.name.length).toBeGreaterThan(0);
      expect(font.stack).toContain(",");
    }
  });

  it("gives every face a real asset url, since the PDF embeds the same file", () => {
    const faces = allNoteFaces();
    expect(faces.length).toBeGreaterThanOrEqual(6);
    for (const { face } of faces) {
      expect(typeof face.assetUrl).toBe("string");
      expect(face.assetUrl.length).toBeGreaterThan(0);
    }
  });

  it("falls back to the default family for an unknown or missing id", () => {
    expect(noteFontById("comic-sans").id).toBe("garamond");
    expect(noteFontById(undefined).id).toBe("garamond");
  });
});

describe("noteFontFace", () => {
  it("resolves a shipped face for every family and every style combination", () => {
    for (const font of NOTE_FONTS) {
      for (const opts of [{}, { bold: true }, { italic: true }, { bold: true, italic: true }]) {
        const face = noteFontFace(font.id, opts);
        const shipped = Object.values(font.faces);
        expect(shipped).toContain(face);
      }
    }
  });

  it("never synthesizes an oblique: a family with no italic falls back to a real face", () => {
    for (const font of NOTE_FONTS) {
      if (font.faces.italic) continue;
      expect(hasItalic(font.id)).toBe(false);
      expect(noteFontFace(font.id, { italic: true })).toBe(font.faces.regular);
      expect(noteFontFace(font.id, { bold: true, italic: true })).toBe(
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
    for (const font of NOTE_FONTS) {
      if (!font.faces.bold) continue;
      expect(noteFontFace(font.id, { bold: true })).toBe(font.faces.bold);
      expect(noteFontFace(font.id, { bold: true }).weight).toBe(700);
    }
  });
});
