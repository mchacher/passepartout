import { useState } from "react";
import { useAlbum } from "../store";
import { useT } from "../useT";
import {
  COLOR_THEMES,
  FONT_THEMES,
  fontThemeStack,
  fontThemeTypeface,
  colorThemeOrDefault,
} from "../lib/themes";
import { TEXT_ROLES, TEXT_SIZE_LEVELS } from "../lib/text-sizes";

// The album style picker in the top bar (same dropdown pattern as ProjectMenu):
// pick the project's font, color theme and per-role text sizes. All apply live to the
// album and, for the accent, to the app chrome. Fonts are previewed in their own
// stack; palettes as a paper + ink + accent swatch; text sizes as an S/M/L toggle.
export function ThemeMenu() {
  const { fontTheme, colorTheme, textSizes, setFontTheme, setColorTheme, setTextSize } =
    useAlbum();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const active = colorThemeOrDefault(colorTheme);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-[6px] text-[12.5px] text-ink hover:border-faint"
        title={t("theme.albumStyle")}
      >
        <span
          className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-line-strong text-[10px] font-semibold"
          style={{ background: active.paper, color: active.ink }}
        >
          A
        </span>
        <span>{t("theme.style")}</span>
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <>
          <button
            aria-label={t("theme.closeMenu")}
            className="fixed inset-0 z-20 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-30 mt-1.5 w-[300px] rounded-xl border border-line bg-surface p-2.5 shadow-soft">
            <div className="px-1 pb-1 text-[11px] uppercase tracking-wide text-faint">{t("theme.font")}</div>
            <div className="flex flex-col gap-0.5">
              {FONT_THEMES.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFontTheme(f.id)}
                  aria-pressed={fontTheme === f.id}
                  className={`flex items-center justify-between rounded-md px-2 py-1.5 text-left text-[15px] ${
                    fontTheme === f.id ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface-2"
                  }`}
                  style={{ fontFamily: fontThemeStack(f) }}
                >
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span>{t(`font.${f.id}`)}</span>
                    {/* The real typeface, so the style is not a mystery and the printed
                        result is nameable (spec 040). */}
                    <span className="truncate font-ui text-[10.5px] text-faint">
                      {fontThemeTypeface(f)}
                    </span>
                  </span>
                  {fontTheme === f.id && <span className="text-accent">•</span>}
                </button>
              ))}
            </div>

            <div className="mt-2.5 px-1 pb-1.5 text-[11px] uppercase tracking-wide text-faint">{t("theme.palette")}</div>
            <div className="grid grid-cols-5 gap-1.5">
              {COLOR_THEMES.map((c) => {
                const selected = colorTheme === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setColorTheme(c.id)}
                    aria-pressed={selected}
                    title={t(`color.${c.id}`)}
                    className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border ${
                      selected ? "border-accent ring-2 ring-accent" : "border-line hover:border-faint"
                    }`}
                    style={{ background: c.paper }}
                  >
                    <span className="h-2 w-6 rounded-full" style={{ background: c.ink }} />
                    <span className="h-2 w-6 rounded-full" style={{ background: c.accent.light }} />
                  </button>
                );
              })}
            </div>
            <div className="mt-1.5 px-1 text-center text-[11px] text-muted">{t(`color.${active.id}`)}</div>

            <div className="mt-2.5 px-1 pb-1.5 text-[11px] uppercase tracking-wide text-faint">{t("theme.textSize")}</div>
            <div className="flex flex-col gap-1">
              {TEXT_ROLES.map((r) => (
                <div key={r.role} className="flex items-center justify-between gap-2">
                  <span className="whitespace-nowrap text-[12px] text-muted">{t(`role.${r.role}`)}</span>
                  <div className="flex gap-0.5 rounded-lg border border-line bg-surface-2 p-[3px]">
                    {TEXT_SIZE_LEVELS.map((lvl) => {
                      const selected = textSizes[r.role] === lvl.level;
                      return (
                        <button
                          key={lvl.level}
                          onClick={() => setTextSize(r.role, lvl.level)}
                          aria-pressed={selected}
                          title={`${t(`role.${r.role}`)} ${lvl.label}`}
                          className={`w-7 rounded-md py-[3px] text-[12px] transition-colors ${
                            selected ? "bg-accent text-white shadow-soft" : "text-muted hover:text-ink"
                          }`}
                        >
                          {lvl.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
