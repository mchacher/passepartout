// Album text-size catalog (pure), a third project-level album-style axis alongside
// the font and color theme in src/lib/themes.ts. Each text ROLE (title, subtitle,
// caption) gets one of three LEVELS (small / medium / large). The level is a
// multiplier applied to the existing hardcoded font sizes via a CSS custom property,
// so medium (1.0) reproduces today's look exactly and nothing about photo geometry is
// touched. The impure application (writing the vars onto <html>) lives in
// useApplyTheme; this module only shapes data.

export type TextRole = "title" | "subtitle" | "caption";
export type TextSizeLevel = "sm" | "md" | "lg";

/** One size level per text role. */
export type TextSizes = Record<TextRole, TextSizeLevel>;

// Cover title and page title share the "title" role: a heading is a heading.
export const TEXT_ROLES: { role: TextRole; name: string }[] = [
  { role: "title", name: "Title" },
  { role: "subtitle", name: "Subtitle" },
  { role: "caption", name: "Caption" },
];

export const TEXT_SIZE_LEVELS: { level: TextSizeLevel; label: string }[] = [
  { level: "sm", label: "S" },
  { level: "md", label: "M" },
  { level: "lg", label: "L" },
];

// Multiplier per level. `md` MUST be 1 so the defaults change nothing.
export const SIZE_SCALE: Record<TextSizeLevel, number> = {
  sm: 0.85,
  md: 1,
  lg: 1.2,
};

export const DEFAULT_TEXT_SIZES: TextSizes = { title: "md", subtitle: "md", caption: "md" };

function levelOrDefault(v: unknown): TextSizeLevel {
  return v === "sm" || v === "md" || v === "lg" ? v : "md";
}

/**
 * A full, valid TextSizes from a possibly missing or partial value: every role is
 * coerced to a known level, an unknown or absent one falling back to `md`. Backward
 * compatibility for documents saved before this feature, like `coverOrDefault`.
 */
export function textSizesOrDefault(v: Partial<TextSizes> | undefined | null): TextSizes {
  return {
    title: levelOrDefault(v?.title),
    subtitle: levelOrDefault(v?.subtitle),
    caption: levelOrDefault(v?.caption),
  };
}

/** Pure map from the chosen sizes to the CSS custom properties that carry them. */
export function textScaleVars(sizes: TextSizes): Record<string, string> {
  return {
    "--title-scale": String(SIZE_SCALE[sizes.title]),
    "--subtitle-scale": String(SIZE_SCALE[sizes.subtitle]),
    "--caption-scale": String(SIZE_SCALE[sizes.caption]),
  };
}
