import { useView } from "../viewStore";
import { LANGS, type Lang } from "../lib/i18n";
import { useT } from "../useT";

// The language selector (spec 032): a small segmented EN / FR control. Used in the top bar and on
// the auth screens (Setup / Login) so the app can be set up in French before signing in. Album
// content is never translated; this only switches the interface chrome.
const LABEL: Record<Lang, string> = { en: "EN", fr: "FR" };

export function LanguageMenu({ className = "" }: { className?: string }) {
  const lang = useView((s) => s.lang);
  const setLang = useView((s) => s.setLang);
  const { t } = useT();

  return (
    <div role="group" aria-label={t("lang.label")} className={`inline-flex items-center gap-0.5 ${className}`}>
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          title={t(`lang.${l}`)}
          className={`rounded-md px-2 py-[5px] text-[11.5px] font-medium transition-colors ${
            lang === l
              ? "bg-accent-soft text-accent"
              : "text-muted hover:text-ink"
          }`}
        >
          {LABEL[l]}
        </button>
      ))}
    </div>
  );
}
