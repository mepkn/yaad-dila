import PocketBase, { AsyncAuthStore } from 'pocketbase';
import * as SecureStore from 'expo-secure-store';

import { POCKETBASE_URL } from '@/lib/config';

const AUTH_KEY = 'pb_auth';

// Auth token lives in expo-secure-store (never AsyncStorage — see SPEC §5.3).
// AsyncAuthStore rehydrates itself from `initial`; await authReady before
// deciding whether to show login or the app.
const initial = SecureStore.getItemAsync(AUTH_KEY);

const store = new AsyncAuthStore({
  save: async (serialized) => SecureStore.setItemAsync(AUTH_KEY, serialized),
  clear: async () => SecureStore.deleteItemAsync(AUTH_KEY),
  initial,
});

export const authReady: Promise<unknown> = initial;

export const pb = new PocketBase(POCKETBASE_URL, store);
