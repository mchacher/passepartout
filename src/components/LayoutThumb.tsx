import type { LayoutNode } from "../lib/layouts";

interface LayoutThumbProps {
  node: LayoutNode;
  size?: number;
  active?: boolean;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Split a rect into child rects the same way the engine does, so the thumbnail is
// a faithful miniature of the real arrangement.
function subdivide(node: LayoutNode, box: Rect, gap: number, out: Rect[]): void {
  if (node.kind === "slot") {
    out.push(box);
    return;
  }
  const n = node.children.length;
  const weights = node.weights ?? node.children.map(() => 1);
  const total = weights.reduce((a, w) => a + w, 0);
  const along = node.axis === "h" ? box.w : box.h;
  const free = Math.max(0, along - gap * (n - 1));
  let offset = node.axis === "h" ? box.x : box.y;
  for (let i = 0; i < n; i++) {
    const s = free * (weights[i] / total);
    const child: Rect =
      node.axis === "h"
        ? { x: offset, y: box.y, w: s, h: box.h }
        : { x: box.x, y: offset, w: box.w, h: s };
    subdivide(node.children[i], child, gap, out);
    offset += s + gap;
  }
}

// A tiny SVG preview of a layout template: nested rectangles, one per photo slot.
export function LayoutThumb({ node, size = 26, active = false }: LayoutThumbProps) {
  const pad = 2;
  const inner = size - pad * 2;
  const rects: Rect[] = [];
  subdivide(node, { x: pad, y: pad, w: inner, h: inner }, 2, rects);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {rects.map((r, i) => (
        <rect
          key={i}
          x={r.x}
          y={r.y}
          width={r.w}
          height={r.h}
          rx={1.5}
          fill={active ? "var(--paper, #fff)" : "currentColor"}
          opacity={active ? 1 : 0.55}
        />
      ))}
    </svg>
  );
}
