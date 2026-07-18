import * as SecureStore from 'expo-secure-store';

const THEME_KEY = 'theme_preference';

export async function getStoredTheme(): Promise<'light' | 'dark' | null> {
  const value = await SecureStore.getItemAsync(THEME_KEY);
  return value === 'light' || value === 'dark' ? value : null;
}

export async function setStoredTheme(theme: 'light' | 'dark'): Promise<void> {
  await SecureStore.setItemAsync(THEME_KEY, theme);
}
