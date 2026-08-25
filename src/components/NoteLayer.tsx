import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAlbum } from "../store";
import { useView } from "../viewStore";
import { useT } from "../useT";
import type { Note, NoteTarget } from "../types";
import {
  CARTOUCHE_PAD_X,
  CARTOUCHE_PAD_Y,
  clampNote,
  measureTracked,
  noteFontSize,
  noteInk,
  noteTargetKey,
  NOTE_LINE,
  NOTE_MIN_W,
  NOTE_REF_W,
  NOTE_TRACKING,
  RULE_GAP,
  RULE_WEIGHT,
  snapNotePlacement,
  wrapLines,
  type NotePalette,
} from "../lib/notes";
import { shippedFontById } from "../lib/fonts";
import { loadNoteFace, noteMeasurer } from "../noteMeasure";

// The ONE place a Note becomes a box (spec 039). The editor page, the cover faces, the page
// rail thumbnails and the book preview all render notes through here, so what you drag is
// what you see everywhere; the PDF painter mirrors the same arithmetic in points.
//
// A note is an OVERLAY: this layer is `pointer-events-none` and only an interactive note
// takes the pointer, so photos underneath keep every gesture they had before notes existed.

// Album print colors as CSS variables. The same pure `noteInk` resolves a real palette in
// print; here the values are custom properties, so a note follows the album style live.
const CSS_PALETTE: NotePalette = {
  ink: "var(--album-ink)",
  inkSoft: "var(--album-ink-soft)",
  accent: "var(--album-accent)",
  paper: "var(--paper)",
};

interface NoteLayerProps {
  notes: Note[] | undefined;
  /** The page box in pixels: notes are positioned as fractions of it. */
  boxW: number;
  boxH: number;
  /** Given = the layer is interactive (select, drag, resize, type). Omitted = read only. */
  target?: NoteTarget;
}

export function NoteLayer({ notes, boxW, boxH, target }: NoteLayerProps) {
  if (!notes || notes.length === 0 || boxW <= 0 || boxH <= 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {notes.map((note) => (
        <NoteView key={note.id} note={note} boxW={boxW} boxH={boxH} target={target} />
      ))}
    </div>
  );
}

interface NoteViewProps {
  note: Note;
  boxW: number;
  boxH: number;
  target?: NoteTarget;
}

function NoteView({ note, boxW, boxH, target }: NoteViewProps) {
  const { updateNote } = useAlbum();
  const { t } = useT();
  const selection = useView((s) => s.note);
  const selectNote = useView((s) => s.selectNote);
  const editNote = useView((s) => s.editNote);
  const interactive = target !== undefined;
  const key = target ? noteTargetKey(target) : "";
  const selected = interactive && selection?.key === key && selection.id === note.id;
  const editing = selected && selection?.editing === true;

  const sizePx = noteFontSize(note.size, boxW);
  const family = shippedFontById(note.font);
  // Wrapping is measured at the canonical reference width, never at the rendered size, so
  // the lines break at the same words in the editor, in a thumbnail and in the PDF.
  const spec = useMemo(
    () => ({
      font: note.font,
      sizePx: noteFontSize(note.size, NOTE_REF_W),
      bold: note.bold,
      italic: note.italic,
    }),
    [note.font, note.size, note.bold, note.italic],
  );

  // Wrap against the real face. Until it has loaded, the canvas would measure a fallback
  // family, so re-wrap once the browser reports the face available.
  const [faceReady, setFaceReady] = useState(0);
  useEffect(() => {
    let alive = true;
    void loadNoteFace(spec).then(() => {
      if (alive) setFaceReady((n) => n + 1);
    });
    return () => {
      alive = false;
    };
  }, [spec]);

  const tracking = note.caps ? NOTE_TRACKING * sizePx : 0;
  const refTracking = note.caps ? NOTE_TRACKING * spec.sizePx : 0;
  const shown = note.caps ? note.text.toUpperCase() : note.text;
  const lines = useMemo(() => {
    const measure = noteMeasurer(spec);
    return wrapLines(shown, note.w * NOTE_REF_W, (s) => measureTracked(s, measure, refTracking));
    // faceReady is a deliberate dependency: it re-wraps once the real face is loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, note.w, refTracking, spec, faceReady]);

  const empty = lines.length === 0;
  const lineH = sizePx * NOTE_LINE;
  const textH = Math.max(1, lines.length) * lineH;
  const padY = note.cartouche ? CARTOUCHE_PAD_Y * sizePx : 0;
  const ruleWeight = Math.max(1, RULE_WEIGHT * sizePx);
  const ruleH = note.rule ? RULE_GAP * sizePx + ruleWeight : 0;
  const boxHeight = textH + 2 * padY + ruleH;

  const color = noteInk(note.ink, note.customInk, CSS_PALETTE);

  // ---- gestures -----------------------------------------------------------------
  const rootRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; ox: number; oy: number } | null>(null);
  const resize = useRef<{ id: number; x: number; w: number } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!interactive || editing) return;
      e.stopPropagation();
      e.preventDefault();
      selectNote(key, note.id);
      drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, ox: note.x, oy: note.y };
      (e.target as Element).setPointerCapture?.(e.pointerId);
    },
    [interactive, editing, selectNote, key, note.id, note.x, note.y],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = drag.current;
      const r = resize.current;
      if (d && d.id === e.pointerId) {
        const snapped = snapNotePlacement(
          d.ox + (e.clientX - d.x) / boxW,
          d.oy + (e.clientY - d.y) / boxH,
        );
        // Clamp with the note's MEASURED height, which only this renderer knows, so the box
        // stays fully on the page instead of hanging off the bottom edge.
        const kept = clampNote({ ...note, ...snapped }, boxHeight / boxH);
        updateNote(target!, note.id, { x: kept.x, y: kept.y });
      } else if (r && r.id === e.pointerId) {
        // The note keeps its centre, so a centered note stays centered while it grows.
        const w = Math.max(NOTE_MIN_W, r.w + (2 * (e.clientX - r.x)) / boxW);
        updateNote(target!, note.id, { w });
      }
    },
    [boxW, boxH, boxHeight, updateNote, target, note],
  );

  const endGesture = useCallback((e: React.PointerEvent) => {
    if (drag.current?.id === e.pointerId) drag.current = null;
    if (resize.current?.id === e.pointerId) resize.current = null;
  }, []);

  const onResizeDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      resize.current = { id: e.pointerId, x: e.clientX, w: note.w };
      (e.target as Element).setPointerCapture?.(e.pointerId);
    },
    [note.w],
  );

  // Focus the textarea when editing opens, and put the caret at the end.
  const textRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!editing) return;
    const el = textRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  const typeStyle: React.CSSProperties = {
    fontFamily: family.stack,
    fontSize: sizePx,
    fontWeight: note.bold ? 700 : 400,
    fontStyle: note.italic ? "italic" : "normal",
    lineHeight: `${lineH}px`,
    letterSpacing: tracking ? `${tracking}px` : undefined,
    color,
    textAlign: note.align,
  };

  return (
    <div
      ref={rootRef}
      className={`note-type absolute ${interactive ? "pointer-events-auto" : ""} ${
        interactive && !editing ? "cursor-move" : ""
      }`}
      style={{
        left: note.x * boxW - (note.w * boxW) / 2,
        top: note.y * boxH - boxHeight / 2,
        width: note.w * boxW,
        transform: note.rotation ? `rotate(${note.rotation}deg)` : undefined,
        opacity: note.opacity ?? 1,
        outline: selected ? "1px dashed var(--accent)" : undefined,
        outlineOffset: selected ? "3px" : undefined,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      onDoubleClick={(e) => {
        if (!interactive) return;
        e.stopPropagation();
        selectNote(key, note.id, true);
      }}
    >
      <div
        style={{
          background: note.cartouche ? "var(--paper)" : undefined,
          padding: note.cartouche ? `${padY}px ${CARTOUCHE_PAD_X * sizePx}px` : undefined,
          boxShadow: note.cartouche ? "0 1px 2px rgba(0,0,0,.06)" : undefined,
          borderTop: note.rule === "over" ? `${ruleWeight}px solid ${color}` : undefined,
          borderBottom: note.rule === "under" ? `${ruleWeight}px solid ${color}` : undefined,
          paddingTop: note.rule === "over" ? RULE_GAP * sizePx + padY : undefined,
          paddingBottom: note.rule === "under" ? RULE_GAP * sizePx + padY : undefined,
        }}
      >
        {editing ? (
          <textarea
            ref={textRef}
            value={note.text}
            onChange={(e) => updateNote(target!, note.id, { text: e.target.value })}
            onBlur={() => editNote(false)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Escape") editNote(false);
            }}
            rows={Math.max(1, lines.length)}
            className="note-type w-full resize-none border-0 bg-transparent p-0 outline-none"
            style={{ ...typeStyle, height: textH, textTransform: note.caps ? "uppercase" : undefined }}
          />
        ) : empty ? (
          <div
            style={{ ...typeStyle, color: "var(--album-ink-soft)", opacity: 0.45 }}
            className={interactive ? "" : "invisible"}
          >
            {interactive ? t("note.placeholder") : ""}
          </div>
        ) : (
          <div style={typeStyle}>
            {lines.map((line, i) => (
              <div key={i} style={{ minHeight: lineH }}>
                {line}
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && !editing && (
        // The width handle: it decides where the text wraps, so a note can be tucked into a
        // column of whitespace. It grows about the centre, keeping the note where it is.
        <button
          aria-label={t("note.widthHandle")}
          title={t("note.widthHandle")}
          onPointerDown={onResizeDown}
          onPointerMove={onPointerMove}
          onPointerUp={endGesture}
          onPointerCancel={endGesture}
          className="absolute -right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 cursor-ew-resize rounded-full border border-paper bg-accent shadow-soft"
        />
      )}
    </div>
  );
}
