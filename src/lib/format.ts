import type { TFunction } from "i18next";
import { localeFor } from "./i18n";
import type { IntervalUnit, RepeatMode } from "@convex/lib/schedule";

type ScheduleFields = {
  intervalCount: number;
  intervalUnit: IntervalUnit;
  repeatMode: RepeatMode;
  repeatTimes?: number;
  startAt: number;
};

// Shared by every date shown in the app: "Sat, 3 Oct" this year,
// "Sat, 3 Oct 2027" otherwise, so lists, summaries and pickers read the same.
function dateOptions(t: number): Intl.DateTimeFormatOptions {
  const sameYear = new Date(t).getFullYear() === new Date().getFullYear();
  return {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  };
}

// Hermes' Hindi locale data keeps English "am"/"pm"; use Hindi day periods.
function localiseDayPeriod(text: string, language: string): string {
  if (language !== "hi") return text;
  return text.replace(/\bam\b/i, "पूर्वाह्न").replace(/\bpm\b/i, "अपराह्न");
}

export function formatDate(t: number, language: string): string {
  return new Date(t).toLocaleDateString(localeFor(language), dateOptions(t));
}

export function formatTime(t: number, language: string): string {
  const text = new Date(t).toLocaleTimeString(localeFor(language), {
    hour: "numeric",
    minute: "2-digit",
  });
  return localiseDayPeriod(text, language);
}

export function formatDateTime(t: number, language: string): string {
  return `${formatDate(t, language)}, ${formatTime(t, language)}`;
}

export function unitLabel(t: TFunction, unit: IntervalUnit, n: number): string {
  return t(`schedule.units.${unit}_${n === 1 ? "one" : "other"}`);
}

// "Every 2 hours, 5 times" / "Once at Mon, 3 Feb, 9:00 am"
export function scheduleSummary(t: TFunction, r: ScheduleFields, language: string): string {
  if (r.repeatMode === "once") {
    return t("schedule.once", { time: formatDateTime(r.startAt, language) });
  }
  const unit = unitLabel(t, r.intervalUnit, r.intervalCount);
  const every =
    r.intervalCount === 1
      ? t("schedule.everyOne", { unit })
      : t("schedule.every", { n: r.intervalCount, unit });
  return r.repeatMode === "forever"
    ? t("schedule.forever", { every })
    : t("schedule.times", { every, n: r.repeatTimes ?? 1 });
}
