import { ClientResponseError } from 'pocketbase';

import { POCKETBASE_URL } from '@/lib/config';
import i18n from '@/lib/i18n';

// PocketBase's ClientResponseError has a useless generic message; unwrap the
// real cause (network failure or per-field validation errors) for display.
export function describeError(err: unknown): string {
  if (err instanceof ClientResponseError) {
    // The SDK reports status 0 for BOTH a dead network and an aborted request
    // (it auto-cancels duplicate in-flight requests sharing a request key).
    // Check isAbort first, or a cancellation reads as a server outage.
    if (err.isAbort) {
      return i18n.t('errors.requestCancelled');
    }
    if (err.status === 0) {
      return i18n.t('errors.serverUnreachable', { url: POCKETBASE_URL });
    }
    const fields = err.response?.data as Record<string, { message?: string }> | undefined;
    if (fields && Object.keys(fields).length > 0) {
      return Object.entries(fields)
        .map(([field, detail]) => `${field}: ${detail?.message ?? i18n.t('errors.invalidField')}`)
        .join('\n');
    }
    return err.response?.message ?? err.message;
  }
  return err instanceof Error ? err.message : String(err);
}
