import { describe, expect, test } from "vitest";
import {
  firstIndexAtOrAfter,
  nextAfterFire,
  nextFromNow,
  occurrence,
  statusAfter,
  type ScheduleSpec,
} from "./lib/schedule";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function spec(overrides: Partial<ScheduleSpec>): ScheduleSpec {
  return {
    startAt: Date.UTC(2026, 0, 1, 3, 30), // 09:00 in Asia/Kolkata
    intervalCount: 1,
    intervalUnit: "days",
    repeatMode: "forever",
    timeZone: "Asia/Kolkata",
    ...overrides,
  };
}

// Local wall-clock rendering, to assert calendar behaviour readably.
function local(t: number, timeZone: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(t));
}

describe("occurrence", () => {
  test("minutes and hours are exact durations", () => {
    const s = spec({ intervalUnit: "minutes", intervalCount: 15 });
    expect(occurrence(s, 4) - s.startAt).toBe(60 * MIN);
    const h = spec({ intervalUnit: "hours", intervalCount: 2 });
    expect(occurrence(h, 3) - h.startAt).toBe(6 * HOUR);
  });

  test("hours stay exact across a DST change", () => {
    // 2026-03-08 01:00 EST; clocks jump to 03:00 EDT at 02:00.
    const s = spec({
      startAt: Date.UTC(2026, 2, 8, 6, 0),
      intervalUnit: "hours",
      timeZone: "America/New_York",
    });
    expect(occurrence(s, 1) - s.startAt).toBe(HOUR);
    expect(local(occurrence(s, 1), s.timeZone)).toBe("2026-03-08 03:00");
  });

  test("days keep local wall time across DST", () => {
    // 2026-03-07 09:00 EST.
    const s = spec({ startAt: Date.UTC(2026, 2, 7, 14, 0), timeZone: "America/New_York" });
    expect(local(occurrence(s, 1), s.timeZone)).toBe("2026-03-08 09:00");
    expect(occurrence(s, 1) - s.startAt).toBe(23 * HOUR);
    expect(local(occurrence(s, 2), s.timeZone)).toBe("2026-03-09 09:00");
  });

  test("weeks step 7 local days", () => {
    const s = spec({ intervalUnit: "weeks", intervalCount: 2 });
    expect(local(occurrence(s, 1), s.timeZone)).toBe("2026-01-15 09:00");
    expect(occurrence(s, 1) - s.startAt).toBe(14 * DAY);
  });

  test("months clamp to the end of short months without drifting", () => {
    // 2026-01-31 09:00 IST.
    const s = spec({ startAt: Date.UTC(2026, 0, 31, 3, 30), intervalUnit: "months" });
    expect(local(occurrence(s, 1), s.timeZone)).toBe("2026-02-28 09:00");
    expect(local(occurrence(s, 2), s.timeZone)).toBe("2026-03-31 09:00");
    expect(local(occurrence(s, 3), s.timeZone)).toBe("2026-04-30 09:00");
    expect(local(occurrence(s, 12), s.timeZone)).toBe("2027-01-31 09:00");
  });

  test("months handle leap years and year rollover", () => {
    const s = spec({ startAt: Date.UTC(2027, 10, 30, 3, 30), intervalUnit: "months", intervalCount: 3 });
    expect(local(occurrence(s, 1), s.timeZone)).toBe("2028-02-29 09:00");
    expect(local(occurrence(s, 2), s.timeZone)).toBe("2028-05-30 09:00");
  });

  test("months use the reminder's zone, not UTC, for the day of month", () => {
    // 2026-01-31 23:30 in New York is already Feb 1 in UTC.
    const s = spec({
      startAt: Date.UTC(2026, 1, 1, 4, 30),
      intervalUnit: "months",
      timeZone: "America/New_York",
    });
    expect(local(occurrence(s, 1), s.timeZone)).toBe("2026-02-28 23:30");
  });
});

describe("next fire time", () => {
  test("advances from the scheduled time, not the clock", () => {
    const s = spec({ intervalUnit: "hours", intervalCount: 1 });
    const scheduled = occurrence(s, 3);
    const lateNow = scheduled + 10 * MIN;
    expect(nextAfterFire(s, scheduled, lateNow)).toBe(occurrence(s, 4));
  });

  test("a very late run skips occurrences that already passed", () => {
    const s = spec({ intervalUnit: "hours" });
    const scheduled = occurrence(s, 3);
    expect(nextAfterFire(s, scheduled, occurrence(s, 6) + MIN)).toBe(occurrence(s, 7));
  });

  test("nextFromNow returns startAt when it is in the future", () => {
    const s = spec({});
    expect(nextFromNow(s, s.startAt - DAY)).toBe(s.startAt);
  });

  test("nextFromNow skips missed occurrences", () => {
    const s = spec({ intervalUnit: "days" });
    const now = occurrence(s, 5) + HOUR;
    expect(nextFromNow(s, now)).toBe(occurrence(s, 6));
  });

  test("nextFromNow still fires a start that passed moments ago", () => {
    const s = spec({});
    expect(nextFromNow(s, s.startAt + 30_000)).toBe(s.startAt);
  });

  test("firstIndexAtOrAfter is exact on boundaries for every unit", () => {
    for (const intervalUnit of ["minutes", "hours", "days", "weeks", "months"] as const) {
      const s = spec({ intervalUnit, intervalCount: 3 });
      for (const k of [0, 1, 7, 40]) {
        expect(firstIndexAtOrAfter(s, occurrence(s, k))).toBe(k);
        expect(firstIndexAtOrAfter(s, occurrence(s, k) + 1)).toBe(k + 1);
      }
    }
  });
});

describe("status", () => {
  test("no fires left is finished; otherwise running or paused as asked", () => {
    const base = spec({ repeatMode: "count", repeatTimes: 3 });
    expect(statusAfter(base, 1, true)).toBe("active");
    expect(statusAfter(base, 1, false)).toBe("paused");
    expect(statusAfter(base, 3, true)).toBe("finished");
    expect(statusAfter(spec({ repeatMode: "once" }), 1, false)).toBe("finished");
    expect(statusAfter(spec({}), 99, false)).toBe("paused");
  });
});
