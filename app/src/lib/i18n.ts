import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import {
  SUPPORTED_LANGUAGES,
  setStoredLanguage,
  type AppLanguage,
} from '@/lib/locale-preference';
import en from '@/lib/locales/en.json';
import hi from '@/lib/locales/hi.json';

// Endonyms — a language's own name never translates, so module scope is fine.
export const LANGUAGE_OPTIONS: { value: AppLanguage; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिन्दी' },
];

export function detectDeviceLanguage(): AppLanguage {
  const code = getLocales()[0]?.languageCode;
  return SUPPORTED_LANGUAGES.includes(code as AppLanguage) ? (code as AppLanguage) : 'en';
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
  },
  lng: detectDeviceLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export async function setAppLanguage(language: AppLanguage): Promise<void> {
  await setStoredLanguage(language);
  await i18n.changeLanguage(language);
}

export default i18n;
