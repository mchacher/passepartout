import { defineConfig } from "vitest/config";

// Self-contained test config so vitest run from server/ uses THIS file and does not climb to
// the repo-root vitest.config.ts (whose deps are not installed in the server CI job).
export default defineConfig({
  test: { include: ["src/**/*.test.ts"] },
});
