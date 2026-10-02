import type { IntervalUnit, RepeatMode } from "@convex/lib/schedule";

// Reminder form values that can be prefilled (e.g. from a voice request).
export type ReminderDraft = {
  title: string;
  message: string;
  note?: string;
  intervalCount: number;
  intervalUnit: IntervalUnit;
  repeatMode: RepeatMode;
  repeatTimes?: number;
  startAt: number;
};

export function encodeDraft(draft: ReminderDraft): string {
  return JSON.stringify(draft);
}

export function decodeDraft(value: string | string[] | undefined): ReminderDraft | undefined {
  if (typeof value !== "string") return undefined;
  try {
    return JSON.parse(value) as ReminderDraft;
  } catch {
    return undefined;
  }
}
