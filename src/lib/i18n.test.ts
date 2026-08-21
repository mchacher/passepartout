import { describe, it, expect } from "vitest";
import { translate, plural, detectLang, messages, LANGS } from "./i18n";
import { CATALOG } from "./layouts";
import { FONT_THEMES, COLOR_THEMES } from "./themes";
import { BOOK_SIZES } from "./book-sizes";
import { MASKS } from "./masks";
import { FRAMES, BORDER_WIDTHS, FRAME_COLORS } from "./frames";
import { PAPERS } from "./print";
import { TEXT_ROLES } from "./text-sizes";

describe("translate", () => {
  it("returns the French string for a known key", () => {
    expect(translate("fr", "topbar.import")).toBe("Importer");
  });

  it("falls back to English when the French key is missing", () => {
    // Force a gap: a key present only in en.
    (messages.en as Record<string, string>)["test.only.en"] = "English only";
    try {
      expect(translate("fr", "test.only.en")).toBe("English only");
    } finally {
      delete (messages.en as Record<string, string>)["test.only.en"];
    }
  });

  it("returns the key itself for an unknown key (never blank)", () => {
    expect(translate("en", "does.not.exist")).toBe("does.not.exist");
  });

  it("interpolates named params", () => {
    expect(translate("en", "topbar.updateAvailable", { version: "1.2.3" })).toBe("Version 1.2.3 is available");
  });

  it("leaves an unknown token in place when a param is missing", () => {
    (messages.en as Record<string, string>)["test.tok"] = "a {x} b";
    try {
      expect(translate("en", "test.tok", { y: 1 })).toBe("a {x} b");
    } finally {
      delete (messages.en as Record<string, string>)["test.tok"];
    }
  });
});

describe("plural", () => {
  const forms = { one: "{n} photo", other: "{n} photos" };

  it("English: 1 is singular, others plural", () => {
    expect(plural("en", 1, forms)).toBe("1 photo");
    expect(plural("en", 3, forms)).toBe("3 photos");
    expect(plural("en", 0, forms)).toBe("0 photos");
  });

  it("French: 0 and 1 are singular, others plural", () => {
    const f = { one: "{n} fois", other: "{n} fois" };
    expect(plural("fr", 0, f)).toBe("0 fois");
    expect(plural("fr", 1, f)).toBe("1 fois");
    expect(plural("fr", 2, f)).toBe("2 fois");
  });
});

describe("detectLang", () => {
  it("maps fr* locales to French, everything else to English", () => {
    expect(detectLang("fr-FR")).toBe("fr");
    expect(detectLang("fr")).toBe("fr");
    expect(detectLang("en-US")).toBe("en");
    expect(detectLang("de")).toBe("en");
    expect(detectLang(undefined)).toBe("en");
    expect(detectLang(null)).toBe("en");
  });
});

describe("catalog parity between languages", () => {
  it("every English key has a French key and vice versa", () => {
    const en = Object.keys(messages.en).sort();
    const fr = Object.keys(messages.fr).sort();
    expect(fr).toEqual(en);
  });

  it("exposes exactly the two supported languages", () => {
    expect([...LANGS]).toEqual(["en", "fr"]);
  });
});

// Catalog display names: English values must equal the pure lib labels (no drift), and every id
// must have a French translation. This is what lets components render `t("layout.<id>")`.
describe("catalog names match the lib catalogs (no drift, full coverage)", () => {
  const check = (prefix: string, entries: { id: string; label: string }[]) => {
    for (const { id, label } of entries) {
      const key = `${prefix}.${id}`;
      expect(messages.en[key], `en ${key}`).toBe(label);
      expect(messages.fr[key], `fr ${key}`).toBeTypeOf("string");
    }
  };

  it("layouts", () => check("layout", CATALOG.map((t) => ({ id: t.id, label: t.label }))));
  it("fonts", () => check("font", FONT_THEMES.map((f) => ({ id: f.id, label: f.name }))));
  it("colors", () => check("color", COLOR_THEMES.map((c) => ({ id: c.id, label: c.name }))));
  it("book sizes", () => check("size", BOOK_SIZES.map((s) => ({ id: s.id, label: s.name }))));
  it("masks", () => check("mask", MASKS.map((m) => ({ id: m.id, label: m.name }))));
  it("frames", () => check("frame", FRAMES.map((f) => ({ id: f.id, label: f.name }))));
  it("border widths", () => check("borderWidth", BORDER_WIDTHS.map((b) => ({ id: b.id, label: b.label }))));
  it("frame colors", () => check("frameColor", FRAME_COLORS.map((c) => ({ id: c.id, label: c.name }))));
  it("papers", () => check("paper", PAPERS.map((p) => ({ id: p.id, label: p.name }))));
  it("text roles", () => check("role", TEXT_ROLES.map((r) => ({ id: r.role, label: r.name }))));
});
