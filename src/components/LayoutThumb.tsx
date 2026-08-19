import { GRID_COLS, GRID_ROWS } from "../lib/layouts";
import type { CellRect } from "../types";

interface LayoutThumbProps {
  cells: CellRect[];
  size?: number;
  active?: boolean;
}

// A tiny SVG preview of a layout template: one rounded rectangle per photo cell, drawn on
// the 12 x 12 grid so the miniature matches the real arrangement. A small gap between
// cells mirrors the engine's gutter.
export function LayoutThumb({ cells, size = 26, active = false }: LayoutThumbProps) {
  const pad = 2;
  const gap = 0.6; // in grid units, purely cosmetic separation
  const inner = size - pad * 2;
  const unitW = inner / GRID_COLS;
  const unitH = inner / GRID_ROWS;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {cells.map((c, i) => (
        <rect
          key={i}
          x={pad + c.col * unitW + (gap / 2) * unitW}
          y={pad + c.row * unitH + (gap / 2) * unitH}
          width={c.colSpan * unitW - gap * unitW}
          height={c.rowSpan * unitH - gap * unitH}
          rx={1.5}
          fill={active ? "var(--paper, #fff)" : "currentColor"}
          opacity={active ? 1 : 0.55}
        />
      ))}
    </svg>
  );
}
