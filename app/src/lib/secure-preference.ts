/**
 * One device preference, stored in expo-secure-store.
 *
 * Every preference module in lib/ is a declaration on top of this: a key, an
 * optional list of accepted values, and nothing else. The rules that were
 * previously restated per preference — validate on read, treat empty as "no
 * preference" — live here once.
 *
 * Deliberately small. No caching, no change events, no migrations: a preference
 * is read at boot and written when the user picks something.
 */
import * as SecureStore from 'expo-secure-store';

export interface SecurePreference<T extends string> {
  /** The stored value, or null when nothing valid is stored. */
  get: () => Promise<T | null>;
  set: (value: T) => Promise<void>;
}

export function securePreference<T extends string>(
  key: string,
  // Omitted for free-form values such as an API key.
  allowed?: readonly T[]
): SecurePreference<T> {
  return {
    async get() {
      const value = await SecureStore.getItemAsync(key);
      if (!value) return null;
      // A value written by an older build may no longer be offered. Reject it
      // rather than letting it reach the UI as an unrenderable option.
      if (allowed && !allowed.includes(value as T)) return null;
      return value as T;
    },
    async set(value) {
      if (value === '') {
        await SecureStore.deleteItemAsync(key);
        return;
      }
      await SecureStore.setItemAsync(key, value);
    },
  };
}
