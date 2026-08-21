import { defineConfig } from "vitest/config";

// Self-contained test config so vitest run from server/ uses THIS file and does not climb to
// the repo root (whose vitest/postcss/tailwind config + deps are not installed in the server
// CI job). An inline (empty) postcss config also stops vite's upward search for postcss.config.
export default defineConfig({
  css: { postcss: { plugins: [] } },
  test: { include: ["src/**/*.test.ts"] },
});
