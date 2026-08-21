import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import pkg from "./package.json";

// Frontend test config (spec 024). Scope the root test run to src/ so the server package
// (server/, its own deps and test run) is never picked up here. Mirrors vite.config.ts's
// plugin + version define so tests behave like the app.
export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  test: { include: ["src/**/*.test.{ts,tsx}"] },
});
