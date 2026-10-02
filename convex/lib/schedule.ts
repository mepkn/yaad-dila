// Pure scheduling math, shared by Convex functions and the app.
//
// Occurrence k (k = 0, 1, 2, ...) of a reminder is startAt advanced by
// k * intervalCount intervalUnits. Every occurrence is computed from startAt,
// never by stepping from the clock, so late runs never shift the schedule and
// month steps don't decay (Jan 31 -> Feb 28 -> Mar 31).
//
// minutes/hours are exact durations. days/weeks/months follow the wall-clock
// calendar of the reminder's IANA time zone, so 9:00 stays 9:00 across DST.

export type IntervalUnit = "minutes" | "hours" | "days" | "weeks" | "months";
export type RepeatMode = "once" | "forever" | "count";

export type ScheduleSpec = {
  startAt: number;
  intervalCount: number;
  intervalUnit: IntervalUnit;
  repeatMode: RepeatMode;
  repeatTimes?: number;
  timeZone: string;
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Past start times within this window still fire immediately instead of being
// skipped, so "start now" picked at minute precision isn't lost.
export const START_GRACE_MS = MINUTE;

type LocalParts = {
  year: number;
  month: number; // 0-11
  day: number;
  hour: number;
  minute: number;
  second: number;
  ms: number;
};

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    formatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

function toLocal(t: number, timeZone: string): LocalParts {
  const parts: Record<string, number> = {};
  for (const p of formatter(timeZone).formatToParts(new Date(t))) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  return {
    year: parts.year,
    month: parts.month - 1,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
    ms: ((t % 1000) + 1000) % 1000,
  };
}

// Offset of timeZone from UTC at instant t, in ms.
function offsetAt(t: number, timeZone: string): number {
  const l = toLocal(t, timeZone);
  const asUtc = Date.UTC(l.year, l.month, l.day, l.hour, l.minute, l.second, l.ms);
  return asUtc - t;
}

// Local wall time -> UTC instant. Date.UTC normalises overflowing fields.
// Times inside a DST gap resolve to the instant just after the gap.
function fromLocal(l: LocalParts, timeZone: string): number {
  const wall = Date.UTC(l.year, l.month, l.day, l.hour, l.minute, l.second, l.ms);
  const first = wall - offsetAt(wall, timeZone);
  const second = wall - offsetAt(first, timeZone);
  if (first === second) return first;
  return Math.max(first, second);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

// The k-th occurrence (0-based) of the schedule.
export function occurrence(spec: ScheduleSpec, k: number): number {
  const n = k * spec.intervalCount;
  switch (spec.intervalUnit) {
    case "minutes":
      return spec.startAt + n * MINUTE;
    case "hours":
      return spec.startAt + n * HOUR;
    case "days":
    case "weeks": {
      const l = toLocal(spec.startAt, spec.timeZone);
      const days = spec.intervalUnit === "weeks" ? n * 7 : n;
      return fromLocal({ ...l, day: l.day + days }, spec.timeZone);
    }
    case "months": {
      const l = toLocal(spec.startAt, spec.timeZone);
      const total = l.month + n;
      const year = l.year + Math.floor(total / 12);
      const month = ((total % 12) + 12) % 12;
      const day = Math.min(l.day, daysInMonth(year, month));
      return fromLocal({ ...l, year, month, day }, spec.timeZone);
    }
  }
}

// Rough step length, used only to jump close to the answer before scanning.
function approxStep(spec: ScheduleSpec): number {
  const c = spec.intervalCount;
  switch (spec.intervalUnit) {
    case "minutes":
      return c * MINUTE;
    case "hours":
      return c * HOUR;
    case "days":
      return c * DAY;
    case "weeks":
      return c * 7 * DAY;
    case "months":
      return c * 28 * DAY;
  }
}

// Smallest occurrence index whose time is >= t.
export function firstIndexAtOrAfter(spec: ScheduleSpec, t: number): number {
  if (t <= spec.startAt) return 0;
  // Start a couple of steps below the estimate (DST and month lengths make
  // calendar steps uneven), then walk forward.
  let k = Math.max(0, Math.floor((t - spec.startAt) / approxStep(spec)) - 2);
  while (k > 0 && occurrence(spec, k) >= t) k -= 1;
  while (occurrence(spec, k) < t) k += 1;
  return k;
}

export function totalFires(spec: ScheduleSpec): number {
  if (spec.repeatMode === "once") return 1;
  if (spec.repeatMode === "count") return spec.repeatTimes ?? 1;
  return Infinity;
}

export function isExhausted(spec: ScheduleSpec, firedCount: number): boolean {
  return firedCount >= totalFires(spec);
}

// The next fire time after a run that was scheduled for `scheduledAt`.
// Steps from the scheduled time, not the clock. If the run was so late that
// later occurrences have also passed, those are skipped (they don't count).
export function nextAfterFire(
  spec: ScheduleSpec,
  scheduledAt: number,
  now: number,
): number {
  const afterScheduled = firstIndexAtOrAfter(spec, scheduledAt + 1);
  const firstFuture = firstIndexAtOrAfter(spec, now);
  return occurrence(spec, Math.max(afterScheduled, firstFuture));
}

// The fire time to schedule when creating, editing or resuming: the first
// occurrence that hasn't passed yet (missed ones are skipped), allowing a short
// grace window so a just-passed start still fires.
export function nextFromNow(spec: ScheduleSpec, now: number): number {
  return occurrence(spec, firstIndexAtOrAfter(spec, now - START_GRACE_MS));
}

export type ReminderStatus = "active" | "paused" | "finished";

export function reminderStatus(r: ScheduleSpec & {
  active: boolean;
  firedCount: number;
}): ReminderStatus {
  if (r.active) return "active";
  return isExhausted(r, r.firedCount) ? "finished" : "paused";
}
