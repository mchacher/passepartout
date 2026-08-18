/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      // Palette lives as CSS custom properties in src/index.css so both themes
      // are defined in one place. Utilities like bg-surface / text-ink map to them.
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        paper: "var(--paper)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        faint: "var(--faint)",
        line: "var(--line)",
        "line-strong": "var(--line-strong)",
        accent: "var(--accent)",
        "accent-ink": "var(--accent-ink)",
        "accent-soft": "var(--accent-soft)",
      },
      fontFamily: {
        // The album's own font: a project-level choice applied via --album-font
        // (see src/lib/themes.ts). Chrome text keeps `display` below.
        album: ["var(--album-font)"],
        display: ["Georgia", "Iowan Old Style", "Times New Roman", "serif"],
        ui: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SF Mono", "Menlo", "Consolas", "monospace"],
      },
      boxShadow: {
        paper: "0 1px 2px rgba(28,34,38,.06), 0 12px 30px rgba(28,34,38,.10)",
        soft: "0 1px 2px rgba(28,34,38,.05), 0 4px 12px rgba(28,34,38,.06)",
      },
    },
  },
  plugins: [],
};
