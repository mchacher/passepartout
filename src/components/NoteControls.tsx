import { useEffect, useRef, useState } from "react";
import { useAlbum } from "../store";
import { useView } from "../viewStore";
import { useT } from "../useT";
import type { Note, NoteAlign, NoteInkId, NoteSizeLevel, NoteTarget } from "../types";
import { NOTE_ALIGNS, NOTE_OPACITIES, NOTE_SIZE_LEVELS, noteTargetKey } from "../lib/notes";
import { hasItalic, SHIPPED_FONTS } from "../lib/fonts";
import { ROTATION_STEPS } from "../lib/rotation";

// The note toolbar (spec 039), shared by the page card and the four cover cards: only the
// target differs. It sits in the same row and wears the same chrome as the photo controls.

interface NoteControlsProps {
  target: NoteTarget;
  notes: Note[] | undefined;
}

const BTN =
  "inline-flex items-center gap-1.5 rounded-md border px-2 py-[5px] text-[11.5px] transition-colors";
const IDLE = "border-line bg-surface text-muted hover:border-faint hover:text-ink";
const ON = "border-accent bg-accent text-white";
const POP =
  "absolute left-0 top-full z-30 mt-1.5 flex flex-col gap-2 rounded-lg border border-line bg-surface p-2 shadow-soft";
const CHIP = "rounded-md border px-2 py-1 text-[11px]";

const INK_SWATCH: Record<Exclude<NoteInkId, "custom">, string> = {
  ink: "var(--album-ink)",
  inkSoft: "var(--album-ink-soft)",
  accent: "var(--album-accent)",
  paper: "var(--paper)",
};

export function NoteControls({ target, notes }: NoteControlsProps) {
  const selectionKey = noteTargetKey(target);
  const { addNote, updateNote, deleteNote } = useAlbum();
  const { t } = useT();
  const selection = useView((s) => s.note);
  const selectNote = useView((s) => s.selectNote);
  const clearNote = useView((s) => s.clearNote);
  const [open, setOpen] = useState<null | "font" | "size" | "ink" | "align" | "effects" | "tilt">(null);

  const selected =
    selection?.key === selectionKey ? notes?.find((n) => n.id === selection.id) : undefined;

  // Close whatever popover is open when the selection moves to another note.
  useEffect(() => {
    setOpen(null);
  }, [selection?.id, selection?.key]);

  // Backspace / Delete removes the selected note, unless its text is being typed.
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!selected || selection?.editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      deleteNote(target, selected.id);
      clearNote();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, selection?.editing, deleteNote, target, clearNote]);

  const patch = (p: Partial<Note>) => {
    if (selected) updateNote(target, selected.id, p);
  };
  const toggle = (key: "bold" | "italic" | "caps" | "cartouche") => {
    if (selected) updateNote(target, selected.id, { [key]: !selected[key] } as Partial<Note>);
  };

  const add = () => {
    const id = addNote(target);
    selectNote(selectionKey, id, true);
  };

  const backdrop = (
    <button
      aria-label={t("note.close")}
      className="fixed inset-0 z-20 cursor-default"
      onClick={() => setOpen(null)}
    />
  );

  if (!selected) {
    return (
      <button onClick={add} title={t("note.addTitle")} className={`${BTN} ${IDLE}`}>
        <NoteIcon />
        {t("note.add")}
      </button>
    );
  }

  const italicAvailable = hasItalic(selected.font);
  const tilt = selected.rotation ?? 0;

  return (
    <div ref={rowRef} className="flex flex-wrap items-center gap-1.5">
      <button onClick={add} title={t("note.addTitle")} className={`${BTN} ${IDLE}`}>
        <NoteIcon />
        {t("note.add")}
      </button>

      {/* Font */}
      <div className="relative">
        <button
          onClick={() => setOpen(open === "font" ? null : "font")}
          aria-pressed={open === "font"}
          title={t("note.fontTitle")}
          className={`${BTN} ${IDLE}`}
        >
          {SHIPPED_FONTS.find((f) => f.id === selected.font)?.name ?? ""}
        </button>
        {open === "font" && (
          <>
            {backdrop}
            <div className={POP}>
              {SHIPPED_FONTS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    patch({ font: f.id, italic: hasItalic(f.id) ? selected.italic : undefined });
                    setOpen(null);
                  }}
                  className={`${CHIP} text-left text-[15px] ${
                    selected.font === f.id ? "border-accent text-accent" : "border-line text-ink hover:border-faint"
                  }`}
                  style={{ fontFamily: f.stack }}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Regular / italic / bold */}
      <div className="flex gap-0.5 rounded-lg border border-line bg-surface p-[3px]">
        <button
          onClick={() => patch({ bold: undefined, italic: undefined })}
          aria-pressed={!selected.bold && !selected.italic}
          title={t("note.regularTitle")}
          className={`rounded-md px-2 py-[3px] text-[11.5px] ${
            !selected.bold && !selected.italic ? "bg-accent text-white" : "text-muted hover:text-ink"
          }`}
        >
          {t("note.regular")}
        </button>
        <button
          onClick={() => toggle("italic")}
          aria-pressed={selected.italic === true}
          disabled={!italicAvailable}
          title={italicAvailable ? t("note.italicTitle") : t("note.noItalic")}
          className={`rounded-md px-2 py-[3px] text-[11.5px] italic disabled:cursor-default disabled:opacity-40 ${
            selected.italic ? "bg-accent text-white" : "text-muted hover:text-ink"
          }`}
        >
          {t("note.italic")}
        </button>
        <button
          onClick={() => toggle("bold")}
          aria-pressed={selected.bold === true}
          title={t("note.boldTitle")}
          className={`rounded-md px-2 py-[3px] text-[11.5px] font-bold ${
            selected.bold ? "bg-accent text-white" : "text-muted hover:text-ink"
          }`}
        >
          {t("note.bold")}
        </button>
      </div>

      {/* Size */}
      <div className="relative">
        <button
          onClick={() => setOpen(open === "size" ? null : "size")}
          aria-pressed={open === "size"}
          title={t("note.sizeTitle")}
          className={`${BTN} ${IDLE}`}
        >
          {t("note.size")}
          <span className="font-mono uppercase">{selected.size}</span>
        </button>
        {open === "size" && (
          <>
            {backdrop}
            <div className={POP}>
              <div className="flex gap-1">
                {NOTE_SIZE_LEVELS.map((level: NoteSizeLevel) => (
                  <button
                    key={level}
                    onClick={() => {
                      patch({ size: level });
                      setOpen(null);
                    }}
                    className={`${CHIP} font-mono uppercase ${
                      selected.size === level ? "border-accent text-accent" : "border-line text-muted hover:border-faint hover:text-ink"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Ink, plus the paper reserve that keeps a note legible over a photo */}
      <div className="relative">
        <button
          onClick={() => setOpen(open === "ink" ? null : "ink")}
          aria-pressed={open === "ink"}
          title={t("note.inkTitle")}
          className={`${BTN} ${IDLE}`}
        >
          {t("note.ink")}
          <span
            className="h-[13px] w-[13px] rounded-[3px] border border-line-strong"
            style={{
              background:
                selected.ink === "custom"
                  ? selected.customInk ?? "var(--album-ink)"
                  : INK_SWATCH[selected.ink],
            }}
          />
        </button>
        {open === "ink" && (
          <>
            {backdrop}
            <div className={POP}>
              <div className="flex gap-1.5">
                {(Object.keys(INK_SWATCH) as (keyof typeof INK_SWATCH)[]).map((id) => (
                  <button
                    key={id}
                    onClick={() => {
                      patch({ ink: id });
                      setOpen(null);
                    }}
                    title={t(`note.ink.${id}`)}
                    aria-label={t(`note.ink.${id}`)}
                    className={`h-8 w-8 rounded-md border-2 ${
                      selected.ink === id ? "border-accent" : "border-line hover:border-faint"
                    }`}
                    style={{ background: INK_SWATCH[id] }}
                  />
                ))}
                <label
                  title={t("note.ink.custom")}
                  className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border-2 ${
                    selected.ink === "custom" ? "border-accent" : "border-line hover:border-faint"
                  }`}
                  style={{ background: selected.customInk ?? "#8c5a3c" }}
                >
                  <input
                    type="color"
                    value={selected.customInk ?? "#8c5a3c"}
                    onChange={(e) => patch({ ink: "custom", customInk: e.target.value })}
                    className="h-0 w-0 opacity-0"
                  />
                </label>
              </div>
              <button
                onClick={() => toggle("cartouche")}
                aria-pressed={selected.cartouche === true}
                title={t("note.reserveTitle")}
                className={`${CHIP} ${
                  selected.cartouche ? "border-accent text-accent" : "border-line text-muted hover:border-faint hover:text-ink"
                }`}
              >
                {t("note.reserve")}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Alignment */}
      <div className="flex gap-0.5 rounded-lg border border-line bg-surface p-[3px]">
        {NOTE_ALIGNS.map((a: NoteAlign) => (
          <button
            key={a}
            onClick={() => patch({ align: a })}
            aria-pressed={selected.align === a}
            title={t(`note.align.${a}`)}
            aria-label={t(`note.align.${a}`)}
            className={`rounded-md px-1.5 py-[4px] ${
              selected.align === a ? "bg-accent text-white" : "text-muted hover:text-ink"
            }`}
          >
            <AlignIcon align={a} />
          </button>
        ))}
      </div>

      {/* Typographic treatments */}
      <div className="relative">
        <button
          onClick={() => setOpen(open === "effects" ? null : "effects")}
          aria-pressed={open === "effects"}
          title={t("note.effectsTitle")}
          className={`${BTN} ${selected.caps || selected.rule || selected.opacity ? ON : IDLE}`}
        >
          {t("note.effects")}
        </button>
        {open === "effects" && (
          <>
            {backdrop}
            <div className={POP}>
              <button
                onClick={() => toggle("caps")}
                aria-pressed={selected.caps === true}
                title={t("note.capsTitle")}
                className={`${CHIP} tracking-[0.2em] ${
                  selected.caps ? "border-accent text-accent" : "border-line text-muted hover:border-faint hover:text-ink"
                }`}
              >
                {t("note.caps")}
              </button>
              <div className="flex gap-1">
                {([null, "over", "under"] as const).map((r) => (
                  <button
                    key={r ?? "none"}
                    onClick={() => patch({ rule: r ?? undefined })}
                    className={`${CHIP} ${
                      (selected.rule ?? null) === r
                        ? "border-accent text-accent"
                        : "border-line text-muted hover:border-faint hover:text-ink"
                    }`}
                  >
                    {t(r ? `note.rule.${r}` : "page.none")}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                {([1, ...NOTE_OPACITIES] as const).map((o) => (
                  <button
                    key={o}
                    onClick={() => patch({ opacity: o === 1 ? undefined : o })}
                    className={`${CHIP} font-mono ${
                      (selected.opacity ?? 1) === o
                        ? "border-accent text-accent"
                        : "border-line text-muted hover:border-faint hover:text-ink"
                    }`}
                  >
                    {Math.round(o * 100)}%
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Tilt, the same steps and range as a photo (spec 020) */}
      <div className="relative">
        <button
          onClick={() => setOpen(open === "tilt" ? null : "tilt")}
          aria-pressed={open === "tilt"}
          title={t("note.tiltTitle")}
          className={`${BTN} ${tilt ? ON : IDLE}`}
        >
          {t("page.tilt")}
        </button>
        {open === "tilt" && (
          <>
            {backdrop}
            <div className={`${POP} flex-row items-center gap-1`}>
              {[...ROTATION_STEPS].reverse().map((s) => (
                <button
                  key={`m${s}`}
                  onClick={() => patch({ rotation: tilt - s })}
                  title={t("page.tiltLeft", { n: s })}
                  className={`${CHIP} border-line text-muted hover:border-faint hover:text-ink`}
                >
                  -{s}
                </button>
              ))}
              <span className="w-11 select-none px-1 text-center font-mono text-[11px] text-muted" aria-live="polite">
                {tilt}&deg;
              </span>
              {ROTATION_STEPS.map((s) => (
                <button
                  key={`p${s}`}
                  onClick={() => patch({ rotation: tilt + s })}
                  title={t("page.tiltRight", { n: s })}
                  className={`${CHIP} border-line text-muted hover:border-faint hover:text-ink`}
                >
                  +{s}
                </button>
              ))}
              <span className="mx-0.5 h-5 w-px bg-line" aria-hidden="true" />
              <button
                onClick={() => patch({ rotation: 0 })}
                disabled={!tilt}
                title={t("page.straightenTitle")}
                className={`${CHIP} border-line text-muted hover:border-faint hover:text-ink disabled:cursor-default disabled:opacity-40`}
              >
                {t("page.straighten")}
              </button>
            </div>
          </>
        )}
      </div>

      <button
        onClick={() => {
          deleteNote(target, selected.id);
          clearNote();
        }}
        title={t("note.deleteTitle")}
        className={`${BTN} ${IDLE}`}
      >
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
          <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7" />
        </svg>
        {t("note.delete")}
      </button>

      <span className="ml-1 text-[11px] text-muted">{t("note.hint")}</span>
    </div>
  );
}

function NoteIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
      <path d="M5 7h14M5 12h9M5 17h5" />
    </svg>
  );
}

function AlignIcon({ align }: { align: NoteAlign }) {
  const lines =
    align === "left"
      ? ["M4 7h16", "M4 12h9", "M4 17h13"]
      : align === "right"
        ? ["M4 7h16", "M11 12h9", "M7 17h13"]
        : ["M4 7h16", "M7 12h10", "M6 17h12"];
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
      {lines.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
