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
  it("has five unique roles and four unique levels", () => {
    const roles = TEXT_ROLES.map((r) => r.role);
    const levels = TEXT_SIZE_LEVELS.map((l) => l.level);
    expect(roles).toEqual([
      "coverTitle",
      "coverSubtitle",
      "pageTitle",
      "pageSubtitle",
      "caption",
    ]);
    expect(new Set(roles).size).toBe(5);
    expect(levels).toEqual(["sm", "md", "lg", "xl"]);
    expect(new Set(levels).size).toBe(4);
  });

  it("keeps medium at 1 and grows monotonically to xl", () => {
    expect(SIZE_SCALE.md).toBe(1);
    expect(SIZE_SCALE.sm).toBeLessThan(1);
    expect(SIZE_SCALE.lg).toBeGreaterThan(1);
    expect(SIZE_SCALE.xl).toBeGreaterThan(SIZE_SCALE.lg);
    expect(DEFAULT_TEXT_SIZES).toEqual({
      coverTitle: "md",
      coverSubtitle: "md",
      pageTitle: "md",
      pageSubtitle: "md",
      caption: "md",
    });
  });
});

describe("textSizesOrDefault", () => {
  it("defaults a missing object to all medium", () => {
    expect(textSizesOrDefault(undefined)).toEqual(DEFAULT_TEXT_SIZES);
    expect(textSizesOrDefault(null)).toEqual(DEFAULT_TEXT_SIZES);
  });

  it("fills a partial value and coerces unknown levels to md", () => {
    expect(textSizesOrDefault({ coverTitle: "xl", caption: "sm" })).toEqual({
      coverTitle: "xl",
      coverSubtitle: "md",
      pageTitle: "md",
      pageSubtitle: "md",
      caption: "sm",
    });
    expect(
      textSizesOrDefault({ pageTitle: "huge" } as unknown as Partial<typeof DEFAULT_TEXT_SIZES>),
    ).toEqual(DEFAULT_TEXT_SIZES);
  });

  it("falls through spec 005's old keys to the defaults", () => {
    // Old shape { title, subtitle, caption } has none of the new role keys except a
    // possible caption, so everything else defaults to md.
    const legacy = { title: "lg", subtitle: "lg", caption: "xl" } as unknown as Partial<
      typeof DEFAULT_TEXT_SIZES
    >;
    expect(textSizesOrDefault(legacy)).toEqual({
      coverTitle: "md",
      coverSubtitle: "md",
      pageTitle: "md",
      pageSubtitle: "md",
      caption: "xl",
    });
  });
});

describe("textScaleVars", () => {
  it("maps the defaults to 1 on every axis", () => {
    expect(textScaleVars(DEFAULT_TEXT_SIZES)).toEqual({
      "--cover-title-scale": "1",
      "--cover-subtitle-scale": "1",
      "--page-title-scale": "1",
      "--page-subtitle-scale": "1",
      "--caption-scale": "1",
    });
  });

  it("maps xl and sm to their multipliers", () => {
    const vars = textScaleVars({
      coverTitle: "xl",
      coverSubtitle: "md",
      pageTitle: "sm",
      pageSubtitle: "lg",
      caption: "md",
    });
    expect(vars["--cover-title-scale"]).toBe(String(SIZE_SCALE.xl));
    expect(vars["--page-title-scale"]).toBe(String(SIZE_SCALE.sm));
    expect(vars["--page-subtitle-scale"]).toBe(String(SIZE_SCALE.lg));
  });
});
