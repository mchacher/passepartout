import { useEffect } from "react";
import { useView } from "./viewStore";
import { translate, plural, type Params, type PluralForms, type Lang } from "./lib/i18n";

// The i18n hook (spec 032). Reads the active language from viewStore (so a component re-renders on
// a language change) and returns bound translation helpers.
//   const { t, tp } = useT();
//   t("topbar.import")                         -> "Importer"
//   t("topbar.updateAvailable", { version })   -> interpolated
//   tp(count, { one: "{n} photo", other: "{n} photos" })  -> plural, count-aware
export function useT() {
  const lang = useView((s) => s.lang);
  return {
    lang,
    t: (key: string, params?: Params) => translate(lang, key, params),
    tp: (count: number, forms: PluralForms, params?: Params) => plural(lang, count, forms, params),
  };
}

/** Just the active language, when a component needs it without the helpers. */
export function useLang(): Lang {
  return useView((s) => s.lang);
}

// Reflect the active language onto the document: the `lang` attribute (accessibility / hyphenation)
// and the CSS `--caption-placeholder` variable that drives the empty-caption hint rendered in CSS
// (the one user-facing string that lives outside the components). Mounted once in App.
export function useApplyLang(): void {
  const lang = useView((s) => s.lang);
  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    // CSS `content` needs a quoted string; JSON.stringify adds the quotes safely.
    root.style.setProperty("--caption-placeholder", JSON.stringify(translate(lang, "page.captionPlaceholder")));
  }, [lang]);
}
