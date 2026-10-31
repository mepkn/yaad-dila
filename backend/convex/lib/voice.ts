// Turning a spoken (or typed) reminder request into reminder form fields.
// Pure: the prompt, the JSON Schema the model answers in, and the checks on its
// answer. voice.ts sends it through kunji's gateway with the user's own AI key.
import { parseLocalDateTime, type IntervalUnit, type RepeatMode } from "./schedule";

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

const UNITS: IntervalUnit[] = ["minutes", "hours", "days", "weeks", "months"];
const MODES: RepeatMode[] = ["once", "forever", "count"];

export const draftSchema = {
  type: "object",
  properties: {
    title: { type: "string", description: "Short title, 2-5 words, in the user's language" },
    message: { type: "string", description: "Notification text addressed to the user" },
    note: { type: "string", description: "Extra details, or empty string" },
    intervalCount: { type: "integer", description: "How many units between reminders, >= 1" },
    intervalUnit: { type: "string", enum: UNITS },
    repeatMode: { type: "string", enum: MODES },
    repeatTimes: { type: "integer", description: "Total number of reminders when repeatMode is count, else 0" },
    startLocal: { type: "string", description: "First reminder as local wall time YYYY-MM-DDTHH:mm" },
  },
  required: ["title", "message", "note", "intervalCount", "intervalUnit", "repeatMode", "repeatTimes", "startLocal"],
  additionalProperties: false,
};

/** "2026-10-31T15:30 (Asia/Kolkata, Saturday)" for the prompt. */
function localNow(now: number, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "long",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute} (${timeZone}, ${parts.weekday})`;
}

export function systemPrompt(now: number, timeZone: string): string {
  return [
    "You turn a spoken reminder request into structured fields for a reminder app.",
    `The current local time is ${localNow(now, timeZone)}.`,
    "Rules:",
    "- A reminder fires every intervalCount intervalUnit, starting at startLocal.",
    "- repeatMode is once for a single reminder, count when a number of times is given, otherwise forever.",
    "- repeatTimes is the total number of reminders including the first (count only).",
    "- If no start is given, start at the next sensible time (now rounded up to the next 5 minutes).",
    "- A start time like 9am that already passed today means tomorrow, unless the request says today.",
    "- For once, intervalCount is 1 and intervalUnit is days.",
    "- Write title, message and note in the same language as the request (Hindi or English).",
    "Answer with the JSON object only.",
  ].join("\n");
}

/** The model's answer as form fields, or null when it can't be used. */
export function toDraft(raw: unknown, timeZone: string): ReminderDraft | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const intervalUnit = UNITS.find((u) => u === r.intervalUnit);
  const repeatMode = MODES.find((m) => m === r.repeatMode);
  const startAt = typeof r.startLocal === "string" ? parseLocalDateTime(r.startLocal.slice(0, 16), timeZone) : null;
  const title = typeof r.title === "string" ? r.title.trim() : "";
  const message = typeof r.message === "string" ? r.message.trim() : "";
  const intervalCount = Math.round(Number(r.intervalCount));
  const repeatTimes = Math.round(Number(r.repeatTimes));
  if (!intervalUnit || !repeatMode || startAt === null || !title) return null;
  return {
    title: title.slice(0, 200),
    message: (message || title).slice(0, 1000),
    note: typeof r.note === "string" && r.note.trim() ? r.note.trim() : undefined,
    intervalCount: intervalCount >= 1 && intervalCount <= 1000 ? intervalCount : 1,
    intervalUnit,
    repeatMode,
    repeatTimes: repeatMode === "count" ? (repeatTimes >= 1 && repeatTimes <= 10000 ? repeatTimes : 1) : undefined,
    startAt,
  };
}
