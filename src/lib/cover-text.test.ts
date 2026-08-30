import { describe, expect, it } from "vitest";
import { coverTextFieldClass } from "./cover-text";

describe("coverTextFieldClass", () => {
  it("hides an empty field at rest and reveals it on hover and on focus", () => {
    const cls = coverTextFieldClass("");
    expect(cls).toContain("opacity-0");
    expect(cls).toContain("group-hover:opacity-100");
    expect(cls).toContain("focus:opacity-100");
  });

  it("treats a blank value as empty", () => {
    expect(coverTextFieldClass("   ")).toBe(coverTextFieldClass(""));
  });

  it("adds nothing to a field that holds a value", () => {
    expect(coverTextFieldClass("Corse 2026")).toBe("");
    expect(coverTextFieldClass(" 2026 ")).toBe("");
  });
});
