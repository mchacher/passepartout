import { useEffect, useState } from "react";
import type { CropRect, Photo } from "../types";
import { DEFAULT_CROP, moveCropRect, resizeCropRect, type CropHandle } from "../lib/crop";

interface CropEditorProps {
  photo: Photo;
  onApply: (crop: CropRect | null) => void; // a full-image crop applies as null (no crop)
  onClose: () => void;
}

// 4 corner + 4 edge handles, with their position (fraction of the crop rect) and cursor.
const HANDLES: { id: CropHandle; fx: number; fy: number; cursor: string }[] = [
  { id: "tl", fx: 0, fy: 0, cursor: "cursor-nwse-resize" },
  { id: "tr", fx: 1, fy: 0, cursor: "cursor-nesw-resize" },
  { id: "bl", fx: 0, fy: 1, cursor: "cursor-nesw-resize" },
  { id: "br", fx: 1, fy: 1, cursor: "cursor-nwse-resize" },
  { id: "t", fx: 0.5, fy: 0, cursor: "cursor-ns-resize" },
  { id: "b", fx: 0.5, fy: 1, cursor: "cursor-ns-resize" },
  { id: "l", fx: 0, fy: 0.5, cursor: "cursor-ew-resize" },
  { id: "r", fx: 1, fy: 0.5, cursor: "cursor-ew-resize" },
];

// Near-full within a small tolerance, so "drag back to full then Done" reliably clears the
// crop despite floating-point residue.
const isFull = (c: CropRect) => c.x < 1e-3 && c.y < 1e-3 && c.w > 1 - 1e-3 && c.h > 1 - 1e-3;

// The photo crop editor (spec 015): the full image with a draggable crop rectangle. Corner
// and edge handles resize it (free aspect), dragging inside moves it; the area outside is
// dimmed. Done keeps only the rectangle; Reset restores the whole image. No distortion: the
// kept region is shown contain-fit wherever the photo appears.
export function CropEditor({ photo, onApply, onClose }: CropEditorProps) {
  const [crop, setCrop] = useState<CropRect>(photo.crop ?? DEFAULT_CROP);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Drag a handle (resize) or the interior (move); deltas are normalized by the displayed
  // image size read at pointer-down.
  const beginDrag = (e: React.PointerEvent, handle: CropHandle | "move") => {
    e.preventDefault();
    e.stopPropagation();
    const imgEl = (e.currentTarget as HTMLElement).closest("[data-crop-stage]")?.querySelector("img");
    if (!imgEl) return;
    const rect = imgEl.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const start = crop;
    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / rect.width;
      const dy = (ev.clientY - startY) / rect.height;
      setCrop(handle === "move" ? moveCropRect(start, dx, dy) : resizeCropRect(start, handle, dx, dy));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const pct = (v: number) => `${v * 100}%`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[rgb(15,18,22)]">
      <div className="flex items-center gap-4 px-5 py-3 text-white/90">
        <span className="font-display text-[14px]">Crop photo</span>
        <span className="text-[12.5px] text-white/55">Drag the corners or edges; drag inside to move.</span>
        <button
          onClick={() => onApply(null)}
          className="ml-auto rounded-lg border border-white/15 px-3 py-1.5 text-[12.5px] text-white/85 hover:bg-white/10"
        >
          Reset
        </button>
        <button
          onClick={onClose}
          className="rounded-lg border border-white/15 px-3 py-1.5 text-[12.5px] text-white/85 hover:bg-white/10"
        >
          Cancel
        </button>
        <button
          onClick={() => onApply(isFull(crop) ? null : crop)}
          className="rounded-lg border border-accent bg-accent px-3 py-1.5 text-[12.5px] text-white hover:bg-accent-ink"
        >
          Done
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center p-8">
        <div data-crop-stage className="relative inline-block select-none">
          <img src={photo.url} alt={photo.name} draggable={false} className="block max-h-[78vh] max-w-full" />
          {/* Dim outside the crop with four bands. */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-0 right-0 top-0 bg-black/55" style={{ height: pct(crop.y) }} />
            <div className="absolute bottom-0 left-0 right-0 bg-black/55" style={{ height: pct(1 - crop.y - crop.h) }} />
            <div className="absolute left-0 bg-black/55" style={{ top: pct(crop.y), height: pct(crop.h), width: pct(crop.x) }} />
            <div className="absolute right-0 bg-black/55" style={{ top: pct(crop.y), height: pct(crop.h), width: pct(1 - crop.x - crop.w) }} />
          </div>
          {/* The crop rectangle: draggable interior + ring + handles. */}
          <div
            className="absolute cursor-move ring-1 ring-white/90"
            style={{ left: pct(crop.x), top: pct(crop.y), width: pct(crop.w), height: pct(crop.h) }}
            onPointerDown={(e) => beginDrag(e, "move")}
          >
            {HANDLES.map((hd) => (
              <span
                key={hd.id}
                onPointerDown={(e) => beginDrag(e, hd.id)}
                className={`absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-[2px] border border-ink bg-white ${hd.cursor}`}
                style={{ left: pct(hd.fx), top: pct(hd.fy) }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
