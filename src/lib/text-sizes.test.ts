import { describe, it, expect } from "vitest";
import {
  DEFAULT_TEXT_SIZES,
  SIZE_SCALE,
  TEXT_ROLES,
  TEXT_SIZE_LEVELS,
  textScaleVars,
  textSizesOrDefault,
} from "./text-sizes";

describe("text-size catalogs", () => {
  it("has three unique roles and three unique levels", () => {
    const roles = TEXT_ROLES.map((r) => r.role);
    const levels = TEXT_SIZE_LEVELS.map((l) => l.level);
    expect(roles).toEqual(["title", "subtitle", "caption"]);
    expect(new Set(roles).size).toBe(3);
    expect(new Set(levels).size).toBe(3);
  });

  it("keeps medium at 1 so defaults change nothing", () => {
    expect(SIZE_SCALE.md).toBe(1);
    expect(DEFAULT_TEXT_SIZES).toEqual({ title: "md", subtitle: "md", caption: "md" });
    expect(SIZE_SCALE.sm).toBeLessThan(1);
    expect(SIZE_SCALE.lg).toBeGreaterThan(1);
  });
});

describe("textSizesOrDefault", () => {
  it("defaults a missing object to all medium", () => {
    expect(textSizesOrDefault(undefined)).toEqual(DEFAULT_TEXT_SIZES);
    expect(textSizesOrDefault(null)).toEqual(DEFAULT_TEXT_SIZES);
  });

  it("fills a partial value and coerces unknown levels to md", () => {
    expect(textSizesOrDefault({ title: "lg" })).toEqual({
      title: "lg",
      subtitle: "md",
      caption: "md",
    });
    expect(
      textSizesOrDefault({ title: "huge", caption: "sm" } as unknown as Partial<typeof DEFAULT_TEXT_SIZES>),
    ).toEqual({ title: "md", subtitle: "md", caption: "sm" });
  });
});

describe("textScaleVars", () => {
  it("maps the defaults to 1 on every axis", () => {
    expect(textScaleVars(DEFAULT_TEXT_SIZES)).toEqual({
      "--title-scale": "1",
      "--subtitle-scale": "1",
      "--caption-scale": "1",
    });
  });

  it("maps sm and lg to their multipliers", () => {
    const vars = textScaleVars({ title: "lg", subtitle: "md", caption: "sm" });
    expect(vars["--title-scale"]).toBe(String(SIZE_SCALE.lg));
    expect(vars["--subtitle-scale"]).toBe("1");
    expect(vars["--caption-scale"]).toBe(String(SIZE_SCALE.sm));
  });
});
