import i18n from '@/lib/i18n';
import { pb } from '@/lib/pb';

// PocketBase's own minimum for the password field.
export const MIN_PASSWORD_LENGTH = 8;

/** Start a session. The root layout's guard reacts to the auth store change. */
export function signIn(email: string, password: string) {
  return pb.collection('users').authWithPassword(email.trim(), password);
}

/** The signed-in user's email, or null before the auth store rehydrates. */
export function currentUserEmail(): string | null {
  return pb.authStore.record?.email ?? null;
}

/**
 * End the session.
 *
 * The root layout subscribes to authStore.onChange and swaps its protected
 * guards, so no screen has to navigate afterwards.
 */
export function logout(): void {
  pb.authStore.clear();
}

/**
 * Change the signed-in user's own password.
 *
 * PocketBase invalidates every existing auth token when the password changes, so
 * the token sitting in the auth store goes stale the moment the update succeeds.
 * Re-authenticating right away mints a fresh one into the same store and keeps
 * the session (and the root layout's auth guard) alive.
 */
export async function changePassword(oldPassword: string, password: string) {
  const record = pb.authStore.record;
  if (!record) throw new Error(i18n.t('errors.notSignedIn'));

  await pb.collection('users').update(record.id, {
    oldPassword,
    password,
    passwordConfirm: password,
  });

  await pb.collection('users').authWithPassword(record.email, password);
}
