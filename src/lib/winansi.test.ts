import { describe, it, expect } from "vitest";
import { winAnsiSafe, isWinAnsiPrintable, CP1252_EXTRAS } from "./winansi";

// Control characters are built with String.fromCharCode on purpose: a raw one in the source
// would make git treat this file as binary, which is the sibling defect fixed alongside.
const ctrl = (code: number) => String.fromCharCode(code);

describe("winAnsiSafe keeps what the standard font can print", () => {
  it("keeps plain ASCII and Latin-1 accents untouched", () => {
    const plain = "Ete a Nimes, foret de Broceliande";
    expect(winAnsiSafe(plain)).toBe(plain);
    const accented = "Été à Nîmes, forêt de Brocéliande, ça coûte 5 £";
    expect(winAnsiSafe(accented)).toBe(accented);
  });

  it("keeps the French ligature, the regression this fixes (issue 75)", () => {
    expect(winAnsiSafe("cœur")).toBe("cœur");
    expect(winAnsiSafe("sœur, œuvre, Œuvres completes")).toBe("sœur, œuvre, Œuvres completes");
  });

  it("keeps curly quotes, dashes and the ellipsis a Mac keyboard produces", () => {
    const typographic = "“bonjour” ‘salut’ – un tiret — et la suite…";
    expect(winAnsiSafe(typographic)).toBe(typographic);
  });

  it("keeps every CP1252 extra", () => {
    const all = CP1252_EXTRAS.join("");
    expect(winAnsiSafe(all)).toBe(all);
    expect(CP1252_EXTRAS).toHaveLength(27);
  });
});

describe("winAnsiSafe drops what it cannot print", () => {
  it("drops emoji and CJK but keeps the text around them", () => {
    // The dropped glyphs leave their surrounding spaces behind: three of them here.
    expect(winAnsiSafe("cœur ☺ 中文 fin")).toBe("cœur   fin");
    expect(winAnsiSafe("vacances \u{1F3D6} 2026")).toBe("vacances  2026");
  });

  it("drops an astral character whole, never half a surrogate pair", () => {
    const out = winAnsiSafe("a\u{1F600}b");
    expect(out).toBe("ab");
    for (const ch of out) expect(ch.codePointAt(0)).toBeLessThan(0x10000);
  });

  it("drops control characters, which the old range filter let through", () => {
    expect(winAnsiSafe("a" + ctrl(1) + "bc")).toBe("abc");
    expect(winAnsiSafe("nul" + ctrl(0) + "here")).toBe("nulhere");
    expect(winAnsiSafe("del" + ctrl(127) + "here")).toBe("delhere");
    expect(winAnsiSafe("line" + ctrl(10) + "break" + ctrl(9) + "tab")).toBe("linebreaktab");
  });

  it("drops the five slots CP1252 leaves undefined", () => {
    for (const code of [0x81, 0x8d, 0x8f, 0x90, 0x9d]) {
      expect(winAnsiSafe(ctrl(code)), `U+${code.toString(16)}`).toBe("");
    }
  });

  it("drops Latin Extended-A letters that are not CP1252 extras", () => {
    expect(winAnsiSafe("Ā ā Ł ł")).toBe("   "); // only the spaces survive
    expect(winAnsiSafe("Š")).toBe("Š"); // but this one IS a CP1252 extra
  });

  it("handles the empty string and a string of only unprintables", () => {
    expect(winAnsiSafe("")).toBe("");
    expect(winAnsiSafe("中文\u{1F3D6}")).toBe("");
  });
});

describe("isWinAnsiPrintable", () => {
  it("accepts the printable ranges and rejects the rest", () => {
    expect(isWinAnsiPrintable(" ")).toBe(true); // 0x20, the first printable
    expect(isWinAnsiPrintable("~")).toBe(true); // 0x7e, the last ASCII printable
    expect(isWinAnsiPrintable(ctrl(127))).toBe(false); // delete
    expect(isWinAnsiPrintable(ctrl(0xa0))).toBe(true); // no-break space
    expect(isWinAnsiPrintable("ÿ")).toBe(true); // the last Latin-1
    expect(isWinAnsiPrintable("Ā")).toBe(false); // just past it
    expect(isWinAnsiPrintable("œ")).toBe(true); // a CP1252 extra
  });
});
