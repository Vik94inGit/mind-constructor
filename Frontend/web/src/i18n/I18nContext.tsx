import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { LANGUAGES, TRANSLATIONS } from "./translations";
import type { Language, Translation } from "./translations";

const STORAGE_KEY = "mc_language";

// A saved past choice wins outright; otherwise matches the browser's own
// language list against what this app actually has translations for
// (navigator.language/.languages are BCP-47 tags like "uk-UA" or "cs" —
// only the primary subtag before any "-" is compared), falling back to
// English when nothing matches. Runs once, synchronously, on first mount —
// unlike the theme (which needs to be set before first paint to avoid a
// flash), a language mismatch for one render is invisible, so there's no
// index.html-level script doing this ahead of time the way ThemeContext's
// getInitialTheme has one.
function getInitialLanguage(): Language {
  if (typeof window === "undefined") return "en";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (LANGUAGES as readonly string[]).includes(stored)) return stored as Language;
  } catch {
    // ignore — falls through to browser-language detection below
  }
  const candidates = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
  for (const tag of candidates) {
    const primary = tag.split("-")[0].toLowerCase();
    if ((LANGUAGES as readonly string[]).includes(primary)) return primary as Language;
  }
  return "en";
}

interface I18nContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Translation;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(getInitialLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Private browsing / storage disabled — the choice still applies for
      // this load, it just won't survive a refresh.
    }
  }, [language]);

  return (
    <I18nContext.Provider value={{ language, setLanguage, t: TRANSLATIONS[language] }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within an I18nProvider");
  return ctx;
}
