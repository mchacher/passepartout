import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "server"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      // Keep the classic two hook rules (identical to react-hooks v5 recommended).
      // react-hooks 7's recommended additionally enables the opinionated React
      // Compiler lints; adopting those is a policy change, not this dependency bump.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // Maintenance scripts are Node programs, not browser code (scripts/harvest-blurb-specs.mjs).
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: { console: "readonly", process: "readonly", fetch: "readonly", setTimeout: "readonly", URLSearchParams: "readonly" },
    },
  },
);
