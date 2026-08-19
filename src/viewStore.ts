import { create } from "zustand";

// Ephemeral view preferences (not album data, so kept out of the album store and out of
// the project document). Persisted to localStorage so a preference survives a refresh.

const GRID_KEY = "pp.showGrid";

function readShowGrid(): boolean {
  try {
    return localStorage.getItem(GRID_KEY) === "1";
  } catch {
    return false;
  }
}

interface ViewState {
  // Show the discreet 12 x 12 page grid on editor pages (spec 013).
  showGrid: boolean;
  toggleGrid: () => void;
}

export const useView = create<ViewState>((set, get) => ({
  showGrid: readShowGrid(),
  toggleGrid: () => {
    const next = !get().showGrid;
    try {
      localStorage.setItem(GRID_KEY, next ? "1" : "0");
    } catch {
      /* ignore a storage failure; the toggle still works in memory */
    }
    set({ showGrid: next });
  },
}));
