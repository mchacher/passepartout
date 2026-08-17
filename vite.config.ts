import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Local-first single-page app. No backend: everything runs in the browser,
// photos never leave the machine. Builds to static files in dist/.
export default defineConfig({
  plugins: [react()],
  server: { port: 5180, open: true },
  build: { target: "es2022" },
});
