import { describe, it, expect } from "vitest";

// A raw control byte in a source file makes git classify that file as BINARY: it then shows
// no diff in a pull request, in `git log -p`, or in a review. `src/lib/pdf-export.ts` carried
// a literal NUL inside a regex (written as a raw byte instead of `\x00`), so every change to
// the PDF painter was invisible to review. Cheap guard so it cannot come back anywhere.
//
// Vite's glob reads the sources, so this needs no node typings and no filesystem walk.
const sources = import.meta.glob("./**/*.{ts,tsx,css}", { query: "?raw", import: "default", eager: true }) as Record<
  string,
  string
>;

// Tab, newline and carriage return are the only control characters a source may hold.
const isAllowed = (code: number) => code >= 32 || code === 9 || code === 10 || code === 13;

describe("source hygiene", () => {
  it("reads every source file", () => {
    expect(Object.keys(sources).length).toBeGreaterThan(20);
  });

  it("has no raw control byte, so every file stays diffable", () => {
    const offenders = Object.entries(sources).flatMap(([path, text]) => {
      for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (!isAllowed(code)) return [`${path}: U+${code.toString(16).padStart(4, "0")} at offset ${i}`];
      }
      return [];
    });
    expect(offenders).toEqual([]);
  });
});
