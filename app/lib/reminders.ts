export type IntervalUnit = 'minutes' | 'hours' | 'days' | 'weeks' | 'months';
export type RepeatMode = 'once' | 'forever' | 'count';

export interface Reminder {
  id: string;
  title: string;
  message: string;
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
  return d.toLocaleString(undefined, {
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
