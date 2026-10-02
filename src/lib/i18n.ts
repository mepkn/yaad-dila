import { getLocales } from "expo-localization";
import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/locales/en";
import hi from "@/locales/hi";

export type AppLanguage = "en" | "hi";
export type LanguagePref = AppLanguage | "system";

export function deviceLanguage(): AppLanguage {
  return getLocales()[0]?.languageCode === "hi" ? "hi" : "en";
}

export function resolveLanguage(pref: LanguagePref): AppLanguage {
  return pref === "system" ? deviceLanguage() : pref;
}

// Locale used for dates and numbers.
export function localeFor(language: string): string {
  return language === "hi" ? "hi-IN" : "en-IN";
}

const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, hi: { translation: hi } },
  lng: deviceLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
