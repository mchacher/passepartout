import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import pkg from "./package.json";

// Local-first single-page app. No backend: everything runs in the browser,
// photos never leave the machine. Builds to static files in dist/.
export default defineConfig({
  plugins: [react()],
  server: { port: 5180, open: true },
  build: { target: "es2022" },
  // The app version, injected as a compile-time constant so the running app can show which
  // build it is (spec 023). A release bumps package.json and the image tag together
  // (scripts/release.sh).
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
});
