import * as SecureStore from "expo-secure-store";
import type { ReminderDraft } from "./draft";
import type { IntervalUnit, RepeatMode } from "@convex/lib/schedule";

// The user's own key; it never leaves the device except to call Gemini.
const KEY_STORE = "gemini.apiKey";
const MODEL = "gemini-flash-latest";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export const getGeminiKey = () => SecureStore.getItemAsync(KEY_STORE);
export const setGeminiKey = (key: string) => SecureStore.setItemAsync(KEY_STORE, key.trim());
export const removeGeminiKey = () => SecureStore.deleteItemAsync(KEY_STORE);

export class GeminiError extends Error {
  constructor(public kind: "badKey" | "network" | "unparseable") {
    super(kind);
  }
}

const UNITS: IntervalUnit[] = ["minutes", "hours", "days", "weeks", "months"];
const MODES: RepeatMode[] = ["once", "forever", "count"];

const responseSchema = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING", description: "Short title, 2-5 words, in the user's language" },
    message: { type: "STRING", description: "Notification text addressed to the user" },
    note: { type: "STRING", description: "Extra details, or empty string" },
    intervalCount: { type: "INTEGER", description: "How many units between reminders, >= 1" },
    intervalUnit: { type: "STRING", enum: UNITS },
    repeatMode: { type: "STRING", enum: MODES },
    repeatTimes: { type: "INTEGER", description: "Total number of reminders when repeatMode is count, else 0" },
    startLocal: { type: "STRING", description: "First reminder as local wall time YYYY-MM-DDTHH:mm" },
  },
  required: ["title", "message", "intervalCount", "intervalUnit", "repeatMode", "repeatTimes", "startLocal"],
};

function localIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function prompt(text: string, now: Date, timeZone: string): string {
  return [
    "You turn a spoken reminder request into structured fields for a reminder app.",
    `The current local time is ${localIso(now)} (${timeZone}, ${now.toLocaleDateString("en-US", { weekday: "long" })}).`,
    "Rules:",
    "- A reminder fires every intervalCount intervalUnit, starting at startLocal.",
    "- repeatMode is once for a single reminder, count when a number of times is given, otherwise forever.",
    "- repeatTimes is the total number of reminders including the first (count only).",
    "- If no start is given, start at the next sensible time (now rounded up to the next 5 minutes).",
    "- A start time like 9am that already passed today means tomorrow, unless the request says today.",
    "- For once, intervalCount is 1 and intervalUnit is days.",
    "- Write title, message and note in the same language as the request (Hindi or English).",
    `Request: """${text}"""`,
  ].join("\n");
}

function parseLocal(value: string): number | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return undefined;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  return Number.isNaN(d.getTime()) ? undefined : d.getTime();
}

function toDraft(raw: Record<string, unknown>): ReminderDraft {
  const intervalUnit = UNITS.includes(raw.intervalUnit as IntervalUnit)
    ? (raw.intervalUnit as IntervalUnit)
    : undefined;
  const repeatMode = MODES.includes(raw.repeatMode as RepeatMode)
    ? (raw.repeatMode as RepeatMode)
    : undefined;
  const startAt = typeof raw.startLocal === "string" ? parseLocal(raw.startLocal) : undefined;
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const message = typeof raw.message === "string" ? raw.message.trim() : "";
  const intervalCount = Math.round(Number(raw.intervalCount));
  const repeatTimes = Math.round(Number(raw.repeatTimes));

  if (!intervalUnit || !repeatMode || startAt === undefined || !title) {
    throw new GeminiError("unparseable");
  }
  return {
    title: title.slice(0, 200),
    message: (message || title).slice(0, 1000),
    note: typeof raw.note === "string" && raw.note.trim() ? raw.note.trim() : undefined,
    intervalCount: intervalCount >= 1 && intervalCount <= 1000 ? intervalCount : 1,
    intervalUnit,
    repeatMode,
    repeatTimes:
      repeatMode === "count" ? (repeatTimes >= 1 && repeatTimes <= 10000 ? repeatTimes : 1) : undefined,
    startAt,
  };
}

// Calls Gemini directly from the device with the user's key.
export async function parseReminder(text: string, apiKey: string): Promise<ReminderDraft> {
  const now = new Date();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt(text, now, timeZone) }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema,
        },
      }),
    });
  } catch {
    throw new GeminiError("network");
  }
  if (response.status === 400 || response.status === 401 || response.status === 403) {
    const body = await response.text();
    throw new GeminiError(/API key|API_KEY|PERMISSION_DENIED|UNAUTHENTICATED/i.test(body) ? "badKey" : "unparseable");
  }
  if (!response.ok) throw new GeminiError("network");

  const json = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const output = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  try {
    return toDraft(JSON.parse(output) as Record<string, unknown>);
  } catch (e) {
    if (e instanceof GeminiError) throw e;
    throw new GeminiError("unparseable");
  }
}
