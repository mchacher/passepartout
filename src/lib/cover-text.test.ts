import { describe, expect, it } from "vitest";
import { coverTextFieldClasses } from "./cover-text";

describe("coverTextFieldClasses", () => {
  it("hides an empty field at rest and reveals it on hover and on focus (#119)", () => {
    const { subtitle } = coverTextFieldClasses("Corse 2026", "");
    expect(subtitle).toContain("opacity-0");
    expect(subtitle).toContain("group-hover:opacity-100");
    expect(subtitle).toContain("focus:opacity-100");
  });

  it("treats a blank value as empty", () => {
    expect(coverTextFieldClasses("Corse", "   ")).toEqual(coverTextFieldClasses("Corse", ""));
  });

  it("adds nothing to a field that holds a value", () => {
    expect(coverTextFieldClasses("Corse 2026", " 2026 ")).toEqual({ title: "", subtitle: "" });
  });

  // #125: the band is sized for the text that exists. An empty field that still took a line
  // pushed the real title out of a bottom band and onto the photo.
  it("takes an empty field out of the flow when the other one has text", () => {
    const { title, subtitle } = coverTextFieldClasses("Corse", "");
    expect(title).toBe("");
    expect(subtitle).toContain("absolute");
    expect(subtitle).toContain("top-full"); // where its line would have been, under the title
  });

  it("puts an empty title back above a subtitle that has text", () => {
    const { title, subtitle } = coverTextFieldClasses("", "Summer 2026");
    expect(subtitle).toBe("");
    expect(title).toContain("absolute");
    expect(title).toContain("bottom-full");
  });

  it("keeps both fields in the flow on a face with no text at all", () => {
    const both = coverTextFieldClasses("", "");
    expect(both.title).not.toContain("absolute");
    expect(both.subtitle).not.toContain("absolute");
    expect(both.title).toContain("opacity-0");
    expect(both.subtitle).toContain("opacity-0");
  });
});
