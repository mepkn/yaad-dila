import { securePreference } from '@/lib/secure-preference';

// 'system' is a real stored value, not the absence of one: NativeWind's
// setColorScheme accepts it, but useColorScheme() only ever reports the
// RESOLVED scheme ('light' | 'dark'). Anything that has to display the user's
// choice must read it from here, never from useColorScheme().
export type AppTheme = 'system' | 'light' | 'dark';

export const THEME_OPTIONS: AppTheme[] = ['system', 'light', 'dark'];

const store = securePreference<AppTheme>('theme_preference', THEME_OPTIONS);

export const getStoredTheme = store.get;
export const setStoredTheme = store.set;
