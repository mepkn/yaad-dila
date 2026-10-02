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

export function formatDateTime(t: number, language: string): string {
  return new Date(t).toLocaleString(localeFor(language), {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDate(t: number, language: string): string {
  return new Date(t).toLocaleDateString(localeFor(language), {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatTime(t: number, language: string): string {
  return new Date(t).toLocaleTimeString(localeFor(language), {
    hour: "numeric",
    minute: "2-digit",
  });
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
