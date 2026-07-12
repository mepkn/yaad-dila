import { ClientResponseError } from 'pocketbase';

import { POCKETBASE_URL } from '@/lib/config';

// PocketBase's ClientResponseError has a useless generic message; unwrap the
// real cause (network failure or per-field validation errors) for display.
export function describeError(err: unknown): string {
  if (err instanceof ClientResponseError) {
    if (err.status === 0) {
      return `Cannot reach the server at ${POCKETBASE_URL}. Check EXPO_PUBLIC_POCKETBASE_URL — a phone cannot reach 127.0.0.1.`;
    }
    const fields = err.response?.data as
      | Record<string, { message?: string }>
      | undefined;
    if (fields && Object.keys(fields).length > 0) {
      return Object.entries(fields)
        .map(([field, detail]) => `${field}: ${detail?.message ?? 'invalid'}`)
        .join('\n');
    }
    return err.response?.message ?? err.message;
  }
  return err instanceof Error ? err.message : String(err);
}
