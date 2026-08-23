import { describe, it, expect } from "vitest";

// The wordmark is written "Passe-partout", with a hyphen: that is how the French word is
// spelled, and a middle dot is not a spelling (issue 88). It is composed in three places (the
// top bar, the login card, the setup title in both languages), which is exactly how the middle
// dot survived in some of them, so guard the character rather than each site.
//
// Vite's glob reads the sources, so this needs no filesystem walk. Prose keeps the English
// one-word spelling "Passepartout" (README, bundle errors, the package name); this is only
// about the displayed wordmark.
const sources = import.meta.glob("./**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }) as Record<
  string,
  string
>;

describe("wordmark", () => {
  it("reads every source file", () => {
    expect(Object.keys(sources).length).toBeGreaterThan(20);
  });

  it("spells the wordmark with a hyphen, never a middle dot", () => {
    const offenders = Object.entries(sources)
      .filter(([, text]) => text.includes("·"))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });
});
