// Album text-size catalog (pure), a third project-level album-style axis alongside
// the font and color theme in src/lib/themes.ts. Each text ROLE (title, subtitle,
// caption) gets one of three LEVELS (small / medium / large). The level is a
// multiplier applied to the existing hardcoded font sizes via a CSS custom property,
// so medium (1.0) reproduces today's look exactly and nothing about photo geometry is
// touched. The impure application (writing the vars onto <html>) lives in
// useApplyTheme; this module only shapes data.

// The cover text and the page text are distinct styles: a page title is not the big
// opening title. Five roles in all (spec 006).
export type TextRole =
  | "coverTitle"
  | "coverSubtitle"
  | "pageTitle"
  | "pageSubtitle"
  | "caption";
export type TextSizeLevel = "sm" | "md" | "lg" | "xl";

/** One size level per text role. */
export type TextSizes = Record<TextRole, TextSizeLevel>;

export const TEXT_ROLES: { role: TextRole; name: string }[] = [
  { role: "coverTitle", name: "Cover title" },
  { role: "coverSubtitle", name: "Cover subtitle" },
  { role: "pageTitle", name: "Page title" },
  { role: "pageSubtitle", name: "Page subtitle" },
  { role: "caption", name: "Caption" },
];

export const TEXT_SIZE_LEVELS: { level: TextSizeLevel; label: string }[] = [
  { level: "sm", label: "S" },
  { level: "md", label: "M" },
  { level: "lg", label: "L" },
  { level: "xl", label: "XL" },
];

// Multiplier per level. `md` MUST be 1 so the defaults change nothing.
export const SIZE_SCALE: Record<TextSizeLevel, number> = {
  sm: 0.85,
  md: 1,
  lg: 1.2,
  xl: 1.45,
};

export const DEFAULT_TEXT_SIZES: TextSizes = {
  coverTitle: "md",
  coverSubtitle: "md",
  pageTitle: "md",
  pageSubtitle: "md",
  caption: "md",
};

function levelOrDefault(v: unknown): TextSizeLevel {
  return v === "sm" || v === "md" || v === "lg" || v === "xl" ? v : "md";
}

/**
 * A full, valid TextSizes from a possibly missing or partial value: every role is
 * coerced to a known level, an unknown or absent one falling back to `md`. Backward
 * compatibility for documents saved before this feature (including spec 005's old
 * {title, subtitle, caption} keys, which simply fall through to the defaults).
 */
export function textSizesOrDefault(v: Partial<TextSizes> | undefined | null): TextSizes {
  return {
    coverTitle: levelOrDefault(v?.coverTitle),
    coverSubtitle: levelOrDefault(v?.coverSubtitle),
    pageTitle: levelOrDefault(v?.pageTitle),
    pageSubtitle: levelOrDefault(v?.pageSubtitle),
    caption: levelOrDefault(v?.caption),
  };
}

/** Pure map from the chosen sizes to the CSS custom properties that carry them. */
export function textScaleVars(sizes: TextSizes): Record<string, string> {
  return {
    "--cover-title-scale": String(SIZE_SCALE[sizes.coverTitle]),
    "--cover-subtitle-scale": String(SIZE_SCALE[sizes.coverSubtitle]),
    "--page-title-scale": String(SIZE_SCALE[sizes.pageTitle]),
    "--page-subtitle-scale": String(SIZE_SCALE[sizes.pageSubtitle]),
    "--caption-scale": String(SIZE_SCALE[sizes.caption]),
  };
}
