import { securePreference } from '@/lib/secure-preference';

export type AppLanguage = 'en' | 'hi';

export const SUPPORTED_LANGUAGES: AppLanguage[] = ['en', 'hi'];

const store = securePreference<AppLanguage>('language_preference', SUPPORTED_LANGUAGES);

export const getStoredLanguage = store.get;
export const setStoredLanguage = store.set;
