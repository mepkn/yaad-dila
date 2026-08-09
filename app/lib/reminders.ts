import i18n from '@/lib/i18n';
import { type Tag } from '@/lib/tags';
export type IntervalUnit = 'minutes' | 'hours' | 'days' | 'weeks' | 'months';
export type RepeatMode = 'once' | 'forever' | 'count';

export interface Reminder {
  id: string;
  title: string;
  message: string;
  note: string;
  tags: string[];
  priority: number;
  interval_n: number;
  interval_unit: IntervalUnit;
  repeat_mode: RepeatMode;
  repeat_count: number;
  fired_count: number;
  start_at: string;
  next_fire: string;
  active: boolean;
  last_error: string;
  expand?: { tags?: Tag[] };
}

// PocketBase serializes dates as "2026-07-12 10:00:00.000Z" — the space makes
// `new Date()` parsing implementation-defined, so normalize to ISO 8601 first.
export function parseUTC(value: string): Date {
  return new Date(value.replace(' ', 'T'));
}

// All display goes through here: UTC in the DB, device-local on screen (SPEC §5.4).
export function formatLocal(value: string): string {
  const d = parseUTC(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString(i18n.language, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// A reminder the engine deactivated after completing its schedule, as opposed
// to one the user paused.
export function isFinished(r: Reminder): boolean {
  if (r.active) return false;
  if (r.repeat_mode === 'once') return r.fired_count >= 1;
  if (r.repeat_mode === 'count') return r.fired_count >= r.repeat_count;
  return false;
}

export const REMINDER_STATUSES = ['all', 'upcoming', 'paused', 'past'] as const;
export type ReminderStatus = (typeof REMINDER_STATUSES)[number];
export type ReminderBucket = Exclude<ReminderStatus, 'all'>;

// The single definition of which bucket a reminder falls in. Every reminder
// lands in exactly one — no overlap, no leftovers. "upcoming" is keyed on
// `active`, not on `next_fire > now`: an active reminder whose next_fire has
// just slipped into the past is about to fire on the next cron tick.
export function statusOf(r: Reminder): ReminderBucket {
  if (r.active) return 'upcoming';
  return isFinished(r) ? 'past' : 'paused';
}
