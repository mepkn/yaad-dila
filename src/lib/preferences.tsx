import AsyncStorage from "@react-native-async-storage/async-storage";
import { colorScheme } from "nativewind";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import i18n, { resolveLanguage, type LanguagePref } from "./i18n";

export type ThemePref = "light" | "dark" | "system";

type Preferences = {
  ready: boolean;
  theme: ThemePref;
  language: LanguagePref;
  setTheme: (theme: ThemePref) => void;
  setLanguage: (language: LanguagePref) => void;
};

const THEME_KEY = "pref.theme";
const LANGUAGE_KEY = "pref.language";

const PreferencesContext = createContext<Preferences | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [theme, setThemeState] = useState<ThemePref>("system");
  const [language, setLanguageState] = useState<LanguagePref>("system");

  useEffect(() => {
    void (async () => {
      try {
        const [storedTheme, storedLanguage] = await Promise.all([
          AsyncStorage.getItem(THEME_KEY),
          AsyncStorage.getItem(LANGUAGE_KEY),
        ]);
        if (storedTheme === "light" || storedTheme === "dark" || storedTheme === "system") {
          setThemeState(storedTheme);
          colorScheme.set(storedTheme);
        }
        if (storedLanguage === "en" || storedLanguage === "hi" || storedLanguage === "system") {
          setLanguageState(storedLanguage);
          await i18n.changeLanguage(resolveLanguage(storedLanguage));
        }
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const setTheme = useCallback((next: ThemePref) => {
    setThemeState(next);
    colorScheme.set(next);
    void AsyncStorage.setItem(THEME_KEY, next);
  }, []);

  const setLanguage = useCallback((next: LanguagePref) => {
    setLanguageState(next);
    void i18n.changeLanguage(resolveLanguage(next));
    void AsyncStorage.setItem(LANGUAGE_KEY, next);
  }, []);

  return (
    <PreferencesContext.Provider value={{ ready, theme, language, setTheme, setLanguage }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): Preferences {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("usePreferences must be used inside PreferencesProvider");
  return value;
}
