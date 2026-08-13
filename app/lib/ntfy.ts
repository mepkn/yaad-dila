/**
 * The user's ntfy config: its shape, where it is stored, and the client-side
 * publish behind the "Send test notification" button.
 *
 * The publish mirrors the server's pb_hooks/lib.js sending logic (SPEC §3) —
 * the cron tick sends the real notifications; this only proves the settings
 * work from the phone.
 *
 * Below is the only code that touches pb.collection('ntfy_config').
 */

import i18n from '@/lib/i18n';
import { pb } from '@/lib/pb';

export type NtfyAuthType = 'none' | 'token' | 'basic';

export interface NtfySettings {
  base_url: string;
  topic: string;
  auth_type: NtfyAuthType;
  token: string;
  username: string;
  password: string;
}

export const EMPTY_NTFY_SETTINGS: NtfySettings = {
  base_url: '',
  topic: '',
  auth_type: 'none',
  token: '',
  username: '',
  password: '',
};

// Trailing slashes and stray spaces are a typing artefact, never intent. Both
// the save and the test send normalize through here, so a test can never
// exercise a different URL from the one that gets stored.
function normalize(settings: NtfySettings): NtfySettings {
  return {
    base_url: settings.base_url.trim().replace(/\/+$/, ''),
    topic: settings.topic.trim(),
    auth_type: settings.auth_type,
    token: settings.token.trim(),
    username: settings.username.trim(),
    // Never trimmed: a leading or trailing space can be part of a password.
    password: settings.password,
  };
}

// The row's id, remembered between a load and the saves that follow it, so the
// screen never has to hold PocketBase bookkeeping. Cleared when no row exists.
let configId: string | null = null;

/** The stored config, or null when this user has not saved one yet. */
export async function loadNtfyConfig(): Promise<NtfySettings | null> {
  try {
    const rec = await pb
      .collection('ntfy_config')
      .getFirstListItem(pb.filter('user = {:user}', { user: pb.authStore.record?.id }));
    configId = rec.id;
    return {
      base_url: rec.base_url ?? '',
      topic: rec.topic ?? '',
      auth_type: (rec.auth_type as NtfyAuthType) || 'none',
      token: rec.token ?? '',
      username: rec.username ?? '',
      password: rec.password ?? '',
    };
  } catch (err) {
    // 404 is the ordinary "nothing saved yet" answer. Anything else — a dead
    // server, an expired token — is a real failure and must not read as an
    // empty config, or the form would invite the user to overwrite what is
    // actually still stored.
    if ((err as { status?: number })?.status !== 404) throw err;
    configId = null;
    return null;
  }
}

/**
 * Create or update this user's config.
 *
 * One row per user is the invariant. Creating a second one would leave
 * loadNtfyConfig() picking between them, and the cron tick reading whichever it
 * found first — so the id is resolved before writing, never assumed.
 */
export async function saveNtfyConfig(settings: NtfySettings): Promise<void> {
  if (!configId) await loadNtfyConfig();

  const data = { ...normalize(settings), user: pb.authStore.record?.id };

  if (configId) {
    await pb.collection('ntfy_config').update(configId, data);
    return;
  }
  const created = await pb.collection('ntfy_config').create(data);
  configId = created.id;
}

// Hermes doesn't reliably ship btoa; reuse the Phase 0 encoder.
function b64encode(str: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < str.length; i += 3) {
    const c1 = str.charCodeAt(i);
    const c2 = i + 1 < str.length ? str.charCodeAt(i + 1) : NaN;
    const c3 = i + 2 < str.length ? str.charCodeAt(i + 2) : NaN;
    const e1 = c1 >> 2;
    const e2 = ((c1 & 3) << 4) | (isNaN(c2) ? 0 : c2 >> 4);
    const e3 = isNaN(c2) ? 64 : ((c2 & 15) << 2) | (isNaN(c3) ? 0 : c3 >> 6);
    const e4 = isNaN(c3) ? 64 : c3 & 63;
    out +=
      chars.charAt(e1) +
      chars.charAt(e2) +
      (e3 === 64 ? '=' : chars.charAt(e3)) +
      (e4 === 64 ? '=' : chars.charAt(e4));
  }
  return out;
}

export async function sendTestNotification(raw: NtfySettings): Promise<void> {
  const settings = normalize(raw);
  if (settings.base_url === '' || settings.topic === '') {
    throw new Error(i18n.t('ntfy.missingConfig'));
  }

  const headers: Record<string, string> = {
    Title: i18n.t('ntfy.testTitle'),
    Priority: '3',
  };
  if (settings.auth_type === 'token') {
    headers.Authorization = 'Bearer ' + settings.token;
  } else if (settings.auth_type === 'basic') {
    headers.Authorization = 'Basic ' + b64encode(settings.username + ':' + settings.password);
  }

  const res = await fetch(`${settings.base_url}/${settings.topic}`, {
    method: 'POST',
    headers,
    body: i18n.t('ntfy.testBody'),
  });
  if (!res.ok) {
    throw new Error(i18n.t('ntfy.httpError', { status: res.status }));
  }
}
