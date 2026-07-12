// Client-side ntfy publish, used only by the "Send test notification" button.
// Mirrors the server's pb_hooks/lib.js sending logic (SPEC §3).

export type NtfyAuthType = 'none' | 'token' | 'basic';

export interface NtfySettings {
  base_url: string;
  topic: string;
  auth_type: NtfyAuthType;
  token: string;
  username: string;
  password: string;
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

export async function sendTestNotification(settings: NtfySettings): Promise<void> {
  const baseUrl = settings.base_url.trim().replace(/\/+$/, '');
  const topic = settings.topic.trim();
  if (baseUrl === '' || topic === '') {
    throw new Error('Base URL and topic are required.');
  }

  const headers: Record<string, string> = {
    Title: 'Test notification',
    Priority: '3',
  };
  if (settings.auth_type === 'token') {
    headers.Authorization = 'Bearer ' + settings.token;
  } else if (settings.auth_type === 'basic') {
    headers.Authorization = 'Basic ' + b64encode(settings.username + ':' + settings.password);
  }

  const res = await fetch(`${baseUrl}/${topic}`, {
    method: 'POST',
    headers,
    body: 'If you can read this, your ntfy setup works.',
  });
  if (!res.ok) {
    throw new Error(`ntfy returned HTTP ${res.status}`);
  }
}
