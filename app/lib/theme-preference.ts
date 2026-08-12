import * as SecureStore from 'expo-secure-store';

const THEME_KEY = 'theme_preference';

// 'system' is a real stored value, not the absence of one: NativeWind's
// setColorScheme accepts it, but useColorScheme() only ever reports the
// RESOLVED scheme ('light' | 'dark'). Anything that has to display the user's
// choice must read it from here, never from useColorScheme().
export type AppTheme = 'system' | 'light' | 'dark';

export const THEME_OPTIONS: AppTheme[] = ['system', 'light', 'dark'];

export async function getStoredTheme(): Promise<AppTheme | null> {
  const value = await SecureStore.getItemAsync(THEME_KEY);
  return THEME_OPTIONS.includes(value as AppTheme) ? (value as AppTheme) : null;
}

export async function setStoredTheme(theme: AppTheme): Promise<void> {
  await SecureStore.setItemAsync(THEME_KEY, theme);
}
