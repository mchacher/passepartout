import { create } from "zustand";
import { clampZoom, ZOOM_DEFAULT } from "./lib/zoom";

// Ephemeral view preferences (not album data, so kept out of the album store and out of
// the project document). Persisted to localStorage so a preference survives a refresh.

const GRID_KEY = "pp.showGrid";
const ZOOM_KEY = "pp.zoom";
const LIB_COLS_KEY = "pp.libraryCols";

// Library thumbnail density (spec 030): the number of columns. More columns = smaller thumbs
// (scan a big library), fewer = larger (see detail). Works regardless of capture dates.
export const LIBRARY_COLS = [2, 3, 4] as const;
const LIBRARY_COLS_DEFAULT = 2;

function readShowGrid(): boolean {
  try {
    return localStorage.getItem(GRID_KEY) === "1";
  } catch {
    return false;
  }
}

function readZoom(): number {
  try {
    const raw = localStorage.getItem(ZOOM_KEY);
    return raw === null ? ZOOM_DEFAULT : clampZoom(Number(raw));
  } catch {
    return ZOOM_DEFAULT;
  }
}

function readLibraryCols(): number {
  try {
    const n = Number(localStorage.getItem(LIB_COLS_KEY));
    return (LIBRARY_COLS as readonly number[]).includes(n) ? n : LIBRARY_COLS_DEFAULT;
  } catch {
    return LIBRARY_COLS_DEFAULT;
  }
}

interface ViewState {
  // Show the discreet 12 x 12 page grid on editor pages (spec 013).
  showGrid: boolean;
  toggleGrid: () => void;
  // Editor zoom: scales the central column's width (spec 016). 1 = 100%.
  zoom: number;
  setZoom: (z: number) => void;
  // Library thumbnail columns (spec 030): one of LIBRARY_COLS.
  libraryCols: number;
  setLibraryCols: (n: number) => void;
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
  zoom: readZoom(),
  setZoom: (z) => {
    const next = clampZoom(z);
    try {
      localStorage.setItem(ZOOM_KEY, String(next));
    } catch {
      /* ignore a storage failure; the zoom still applies in memory */
    }
    set({ zoom: next });
  },
  libraryCols: readLibraryCols(),
  setLibraryCols: (n) => {
    if (!(LIBRARY_COLS as readonly number[]).includes(n)) return;
    try {
      localStorage.setItem(LIB_COLS_KEY, String(n));
    } catch {
      /* ignore a storage failure; still applies in memory */
    }
    set({ libraryCols: n });
  },
}));
