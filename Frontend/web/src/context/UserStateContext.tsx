import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import * as stateApi from "../api/state";
import type { Preferences } from "../api/state";
import { useAuth } from "./AuthContext";
import { useTheme } from "../theme/ThemeContext";
import { useI18n } from "../i18n/I18nContext";
import { loadCompactView, loadReadingMode, saveCompactView, saveReadingMode } from "../utils/readingMode";

// The signed-in user's preferences and the map they were last on, kept on the
// server so every device they sign in on picks up where they left off. This
// device's own copy (localStorage) still loads first, so nothing waits on the
// network; the server's copy then wins, and every change is sent back.

interface UserStateValue {
  /** null until loaded (or with nobody signed in). */
  preferences: Preferences | null;
  lastMapId: string | null;
  savePreferences: (patch: Preferences) => void;
  /** A map was just opened — it's now the one they were last on (the server is told by the map's own view save). */
  noteMapOpened: (mapId: string) => void;
}

const UserStateContext = createContext<UserStateValue | null>(null);

export function UserStateProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage } = useI18n();
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [lastMapId, setLastMapId] = useState<string | null>(null);
  // What the server is known to hold, so a change only goes out when it differs.
  const sentRef = useRef<Preferences>({});
  const userId = user?._id ?? null;
  const isDemo = !!user?.isDemo;

  const savePreferences = useCallback(
    (patch: Preferences) => {
      if (!userId || isDemo) return;
      const changed = Object.fromEntries(
        Object.entries(patch).filter(([k, v]) => sentRef.current[k as keyof Preferences] !== v),
      ) as Preferences;
      if (Object.keys(changed).length === 0) return;
      sentRef.current = { ...sentRef.current, ...changed };
      setPreferences((p) => ({ ...(p ?? {}), ...changed }));
      stateApi.savePreferences(changed).catch(() => {
        // Offline or the server is busy: this device keeps its own copy, and
        // the next change sends everything that differs again.
        for (const k of Object.keys(changed)) delete sentRef.current[k as keyof Preferences];
      });
    },
    [userId, isDemo],
  );

  useEffect(() => {
    setPreferences(null);
    setLastMapId(null);
    sentRef.current = {};
    if (!userId || isDemo) return;
    let cancelled = false;
    stateApi
      .getUserState()
      .then((state) => {
        if (cancelled) return;
        const saved = state.preferences;
        sentRef.current = { ...saved };
        // The server's copy wins…
        if (saved.theme) setTheme(saved.theme);
        if (saved.language) setLanguage(saved.language);
        if (saved.readingMode) saveReadingMode(saved.readingMode);
        if (saved.compactView !== undefined) saveCompactView(saved.compactView);
        // …and whatever it doesn't have yet comes from this device.
        const local: Preferences = {
          theme: saved.theme ?? (document.documentElement.dataset.theme === "dark" ? "dark" : "light"),
          language: saved.language ?? language,
          readingMode: saved.readingMode ?? loadReadingMode(),
          compactView: saved.compactView ?? loadCompactView(),
        };
        setPreferences(local);
        setLastMapId(state.lastMapId);
        savePreferences(local);
      })
      .catch(() => {
        if (!cancelled) setPreferences({});
      });
    return () => {
      cancelled = true;
    };
    // Loaded once per signed-in user; theme/language changes are sent below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isDemo]);

  // Theme and language are switched from the navbar; send them on.
  useEffect(() => {
    if (preferences) savePreferences({ theme, language });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, language]);

  const noteMapOpened = useCallback((mapId: string) => setLastMapId(mapId), []);
  const value = useMemo(
    () => ({ preferences, lastMapId, savePreferences, noteMapOpened }),
    [preferences, lastMapId, savePreferences, noteMapOpened],
  );
  return <UserStateContext.Provider value={value}>{children}</UserStateContext.Provider>;
}

// Outside the provider (a component rendered on its own, in a test) there's
// simply nothing synced: no saved preferences, and saving does nothing.
const NOT_SYNCED: UserStateValue = {
  preferences: null,
  lastMapId: null,
  savePreferences: () => {},
  noteMapOpened: () => {},
};

export function useUserState(): UserStateValue {
  return useContext(UserStateContext) ?? NOT_SYNCED;
}
