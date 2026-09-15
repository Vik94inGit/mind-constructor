import { useI18n } from "../i18n/I18nContext";
import { LANGUAGES, LANGUAGE_LABELS } from "../i18n/translations";
import type { Language } from "../i18n/translations";

// Short codes for the closed control's own width — the full name (still
// used as each <option>'s own label/title) would make this the widest
// thing in whichever toolbar cluster it sits in.
const LANGUAGE_SHORT_LABELS: Record<Language, string> = {
  en: "ENG",
  cs: "CZ",
  uk: "UKR",
  ru: "RU",
};

// A plain native <select>, not a custom dropdown — only 4 options, and a
// native control gets keyboard/screen-reader support for free with none of
// the outside-click/Escape wiring every other dropdown in this app
// (AddMenu, CanvasContextMenu, ...) has to build by hand.
export function LanguageSwitcher() {
  const { language, setLanguage, t } = useI18n();

  return (
    <select
      aria-label={t.language.label}
      title={t.language.label}
      value={language}
      onChange={(e) => setLanguage(e.target.value as Language)}
      className="h-8 w-[4.2rem] cursor-pointer rounded-md border border-line bg-surface px-[0.35rem] text-[0.72rem] font-semibold text-ink"
    >
      {LANGUAGES.map((lang) => (
        <option key={lang} value={lang} title={LANGUAGE_LABELS[lang]}>
          {LANGUAGE_SHORT_LABELS[lang]}
        </option>
      ))}
    </select>
  );
}
