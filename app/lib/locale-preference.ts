import * as SecureStore from 'expo-secure-store';

export type AppLanguage = 'en' | 'hi';

export const SUPPORTED_LANGUAGES: AppLanguage[] = ['en', 'hi'];

const LANGUAGE_KEY = 'language_preference';

export async function getStoredLanguage(): Promise<AppLanguage | null> {
  const value = await SecureStore.getItemAsync(LANGUAGE_KEY);
  return SUPPORTED_LANGUAGES.includes(value as AppLanguage) ? (value as AppLanguage) : null;
}

export async function setStoredLanguage(language: AppLanguage): Promise<void> {
  await SecureStore.setItemAsync(LANGUAGE_KEY, language);
}
