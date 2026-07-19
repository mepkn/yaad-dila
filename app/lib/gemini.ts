// Voice/NL reminder parsing via the user's own Google Gemini API key.
// The key lives in SecureStore (same pattern as theme/locale preferences)
// and the app calls the Gemini API directly — the backend is not involved.
import i18n from '@/lib/i18n';
import type { IntervalUnit, RepeatMode } from '@/lib/reminders';
import * as SecureStore from 'expo-secure-store';

const GEMINI_KEY = 'gemini_api_key';
// Alias that always points at Google's current flash model — concrete model
// ids (e.g. gemini-2.5-flash) 404 once retired or gated off newer keys.
const MODEL = 'gemini-flash-latest';

export async function getStoredGeminiKey(): Promise<string | null> {
  return SecureStore.getItemAsync(GEMINI_KEY);
}

export async function setStoredGeminiKey(key: string): Promise<void> {
  if (key) {
    await SecureStore.setItemAsync(GEMINI_KEY, key);
  } else {
    await SecureStore.deleteItemAsync(GEMINI_KEY);
  }
}

export type ParsedReminder = {
  title: string;
  message: string;
  interval_n: number;
  interval_unit: IntervalUnit;
  repeat_mode: RepeatMode;
  repeat_count: number;
  start_at: Date; // local time
};

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    expressible: { type: 'BOOLEAN' },
    title: { type: 'STRING' },
    message: { type: 'STRING' },
    interval_n: { type: 'INTEGER' },
    interval_unit: {
      type: 'STRING',
      enum: ['minutes', 'hours', 'days', 'weeks', 'months'],
    },
    repeat_mode: { type: 'STRING', enum: ['once', 'forever', 'count'] },
    repeat_count: { type: 'INTEGER' },
    start_at: { type: 'STRING', description: 'Local datetime, format YYYY-MM-DDTHH:MM' },
  },
  required: ['expressible', 'title', 'message', 'interval_n', 'interval_unit', 'repeat_mode', 'repeat_count', 'start_at'],
} as const;

function buildPrompt(text: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const local = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
  return [
    'You convert a spoken reminder request into fields for a reminder app.',
    `The current local date and time is ${local} (${weekday}).`,
    'Rules:',
    '- The schedule model is ONLY: start at a datetime, then repeat every N units (minutes|hours|days|weeks|months), either once, forever, or a fixed count of times.',
    '- If the request needs anything else (e.g. "every second Tuesday", "weekdays only"), set expressible=false and leave other fields at sensible defaults.',
    '- title: short (a few words). message: the notification text, a full sentence.',
    '- start_at: the FIRST time it should fire, as local time, format YYYY-MM-DDTHH:MM. If no time given, pick the next sensible upcoming time.',
    '- If it fires only once: repeat_mode=once, interval_n=1, interval_unit=days, repeat_count=0.',
    '- repeat_count is 0 unless repeat_mode=count.',
    '- Write title and message in the same language as the request.',
    `Request: """${text}"""`,
  ].join('\n');
}

export async function parseReminderText(text: string, apiKey: string): Promise<ParsedReminder> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(text) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    }
  );
  if (!res.ok) {
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      throw new Error(i18n.t('ai.badKey'));
    }
    throw new Error(i18n.t('ai.requestFailed', { status: res.status }));
  }
  const body = await res.json();
  const raw = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error(i18n.t('ai.parseFailed'));

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(i18n.t('ai.parseFailed'));
  }
  if (!parsed.expressible) throw new Error(i18n.t('ai.notExpressible'));

  const startAt = parseLocalDateTime(String(parsed.start_at ?? ''));
  if (!startAt) throw new Error(i18n.t('ai.parseFailed'));

  const units: IntervalUnit[] = ['minutes', 'hours', 'days', 'weeks', 'months'];
  const modes: RepeatMode[] = ['once', 'forever', 'count'];
  const intervalUnit = units.includes(parsed.interval_unit as IntervalUnit)
    ? (parsed.interval_unit as IntervalUnit)
    : 'days';
  const repeatMode = modes.includes(parsed.repeat_mode as RepeatMode)
    ? (parsed.repeat_mode as RepeatMode)
    : 'once';

  return {
    title: String(parsed.title ?? '').trim(),
    message: String(parsed.message ?? '').trim(),
    interval_n: Math.max(1, Number(parsed.interval_n) || 1),
    interval_unit: intervalUnit,
    repeat_mode: repeatMode,
    repeat_count: repeatMode === 'count' ? Math.max(1, Number(parsed.repeat_count) || 1) : 0,
    start_at: startAt,
  };
}

function parseLocalDateTime(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  const d = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5])
  );
  return isNaN(d.getTime()) ? null : d;
}
