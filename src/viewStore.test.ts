import { describe, it, expect, beforeEach, vi } from "vitest";

// Minimal in-memory localStorage (tests run in node). Only what viewStore uses.
class MemStorage {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

// viewStore reads localStorage / navigator at module load, so each case stubs the globals then
// imports a fresh module instance.
async function freshStore(opts: { navLang?: string; stored?: string; brokenStorage?: boolean }) {
  vi.resetModules();
  const store = new MemStorage();
  if (opts.stored) store.setItem("pp.lang", opts.stored);
  const ls = opts.brokenStorage
    ? {
        getItem() {
          throw new Error("blocked");
        },
        setItem() {
          throw new Error("blocked");
        },
        removeItem() {
          throw new Error("blocked");
        },
      }
    : store;
  vi.stubGlobal("localStorage", ls);
  vi.stubGlobal("navigator", { language: opts.navLang ?? "en-US" });
  const mod = await import("./viewStore");
  return { useView: mod.useView, store };
}

describe("viewStore language preference (spec 032)", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("defaults to French from a fr* browser locale when nothing is stored", async () => {
    const { useView } = await freshStore({ navLang: "fr-FR" });
    expect(useView.getState().lang).toBe("fr");
  });

  it("defaults to English for a non-fr locale", async () => {
    const { useView } = await freshStore({ navLang: "de-DE" });
    expect(useView.getState().lang).toBe("en");
  });

  it("prefers a stored language over the browser locale", async () => {
    const { useView } = await freshStore({ navLang: "en-US", stored: "fr" });
    expect(useView.getState().lang).toBe("fr");
  });

  it("setLang updates state and persists the choice", async () => {
    const { useView, store } = await freshStore({ navLang: "en-US" });
    useView.getState().setLang("fr");
    expect(useView.getState().lang).toBe("fr");
    expect(store.getItem("pp.lang")).toBe("fr");
  });

  it("setLang still applies in memory when storage throws", async () => {
    const { useView } = await freshStore({ navLang: "en-US", brokenStorage: true });
    useView.getState().setLang("fr");
    expect(useView.getState().lang).toBe("fr");
  });
});
