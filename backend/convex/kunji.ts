import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
import { getOwnedReminder } from "./lib/access";
import { findKunjiUser, type KunjiTool } from "./lib/kunji";
import { reschedule } from "./lib/scheduling";
import { isValidTimeZone, parseLocalDateTime } from "./lib/schedule";
import { insertReminder, setReminderActive } from "./reminders";
import { intervalUnit, repeatMode, reminderStatus } from "./schema";

// Yaad Dila's tools for kunji (kunji SPEC.md → App contract). Each runs as the
// user kunji named and only ever sees that user's reminders. Writes:
// add_reminder, snooze_reminder and set_reminder_active; nothing deletes.

// The app's ConvexErrors are i18n codes; kunji shows the message to a model.
const MESSAGES: Record<string, string> = {
  titleRequired: "The title can't be empty.",
  titleTooLong: "The title is too long (200 characters at most).",
  messageRequired: "The message can't be empty.",
  messageTooLong: "The message is too long (1000 characters at most).",
  invalidIntervalCount: "\"every\" must be a whole number from 1 to 1000.",
  invalidRepeatTimes: "\"times\" must be a whole number from 1 to 10000.",
  invalidStartAt: "The start time is not valid.",
  invalidTimeZone: "The time zone is not a valid IANA zone, e.g. Asia/Kolkata.",
  tooManyTags: "A reminder can have at most 20 tags.",
  tagNotFound: "That tag no longer exists.",
  reminderNotFound: "No such reminder. Use list_upcoming or search_reminders to find its id.",
  reminderFinished: "This reminder has finished; edit it in the app to schedule more.",
};

/** Runs fn, turning the app's error codes into sentences. */
async function inEnglish<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ConvexError && typeof err.data === "string" && MESSAGES[err.data]) {
      throw new ConvexError(MESSAGES[err.data]);
    }
    throw err;
  }
}

async function ownedReminder(ctx: QueryCtx, userId: Id<"users">, id: string) {
  const reminderId = ctx.db.normalizeId("reminders", id.trim());
  if (reminderId === null) throw new ConvexError("reminderNotFound");
  return await getOwnedReminder(ctx, userId, reminderId);
}

export const access = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => await findKunjiUser(ctx, email),
});

const UNIT_SINGULAR = { minutes: "minute", hours: "hour", days: "day", weeks: "week", months: "month" } as const;

/** "once", "every 2 hours", "every day, 5 times". */
function describeSchedule(r: Doc<"reminders">): string {
  if (r.repeatMode === "once") return "once";
  const every =
    r.intervalCount === 1 ? `every ${UNIT_SINGULAR[r.intervalUnit]}` : `every ${r.intervalCount} ${r.intervalUnit}`;
  return r.repeatMode === "count" ? `${every}, ${r.repeatTimes} times` : every;
}

/** Local wall-clock time in the reminder's own zone, e.g. "Sat, 31 Oct 2026, 15:30". */
function localTime(t: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(t);
}

/** The shape every tool returns for a reminder: small, and readable by a model. */
async function present(ctx: QueryCtx, r: Doc<"reminders">) {
  const tags = await Promise.all(r.tagIds.map((id) => ctx.db.get("tags", id)));
  return {
    id: r._id,
    title: r.title,
    message: r.message,
    ...(r.note ? { note: r.note } : {}),
    status: r.status,
    schedule: describeSchedule(r),
    timesSent: r.firedCount,
    ...(r.status === "finished"
      ? {}
      : { nextAt: new Date(r.nextFireAt).toISOString(), nextLocal: localTime(r.nextFireAt, r.timeZone) }),
    ...(r.lastFiredAt ? { lastSentAt: new Date(r.lastFiredAt).toISOString() } : {}),
    timeZone: r.timeZone,
    tags: tags.flatMap((t) => (t ? [t.name] : [])),
  };
}

export const listUpcoming = internalQuery({
  args: { userId: v.id("users"), limit: v.number(), withinHours: v.optional(v.number()) },
  handler: async (ctx, { userId, limit, withinHours }) => {
    const until = withinHours === undefined ? undefined : Date.now() + withinHours * 3_600_000;
    const rows = await ctx.db
      .query("reminders")
      .withIndex("by_userId_and_status_and_nextFireAt", (q) => {
        const active = q.eq("userId", userId).eq("status", "active");
        return until === undefined ? active : active.lte("nextFireAt", until);
      })
      .take(limit);
    return await Promise.all(rows.map((r) => present(ctx, r)));
  },
});

export const searchReminders = internalQuery({
  args: { userId: v.id("users"), query: v.string(), status: v.optional(reminderStatus), limit: v.number() },
  handler: async (ctx, { userId, query, status, limit }) => {
    const text = query.trim();
    if (!text) return [];
    // The search index filters by user only, so status is filtered here.
    const rows = await ctx.db
      .query("reminders")
      .withSearchIndex("search_text", (q) => q.search("searchText", text).eq("userId", userId))
      .take(status === undefined ? limit : 100);
    const matches = status === undefined ? rows : rows.filter((r) => r.status === status).slice(0, limit);
    return await Promise.all(matches.map((r) => present(ctx, r)));
  },
});

/** The zone of the user's newest reminder (of up to 100), else UTC. */
async function defaultTimeZone(ctx: QueryCtx, userId: Id<"users">): Promise<string> {
  const rows = await ctx.db
    .query("reminders")
    .withIndex("by_userId_and_status_and_nextFireAt", (q) => q.eq("userId", userId))
    .take(100);
  const newest = rows.reduce<Doc<"reminders"> | null>((a, r) => (a && a._creationTime > r._creationTime ? a : r), null);
  return newest?.timeZone ?? "UTC";
}

/** An ISO time with an offset, or a local "YYYY-MM-DDTHH:mm" read in timeZone. */
function parseStart(text: string, timeZone: string): number {
  const trimmed = text.trim();
  const t = /(Z|[+-]\d{2}:?\d{2})$/i.test(trimmed) ? Date.parse(trimmed) : parseLocalDateTime(trimmed, timeZone);
  if (t === null || !Number.isFinite(t)) {
    throw new ConvexError(`Can't read the start time "${text}". Use ISO 8601, e.g. 2026-11-01T09:00.`);
  }
  return t;
}

/** Existing tags by name (case-insensitive); unknown names are refused. */
async function tagIdsByName(ctx: QueryCtx, userId: Id<"users">, names: string[]): Promise<Id<"tags">[]> {
  if (names.length === 0) return [];
  const tags = await ctx.db
    .query("tags")
    .withIndex("by_userId_and_name", (q) => q.eq("userId", userId))
    .take(500);
  const byName = new Map(tags.map((t) => [t.name.toLowerCase(), t._id]));
  const missing = names.filter((n) => !byName.has(n.toLowerCase()));
  if (missing.length > 0) {
    const known = tags.map((t) => t.name).join(", ") || "none yet";
    throw new ConvexError(`No tag named ${missing.map((n) => `"${n}"`).join(", ")}. The user's tags: ${known}. Tags are created in the app.`);
  }
  return names.map((n) => byName.get(n.toLowerCase())!);
}

export const addReminder = internalMutation({
  args: {
    userId: v.id("users"),
    title: v.string(),
    message: v.optional(v.string()),
    note: v.optional(v.string()),
    startAt: v.optional(v.string()),
    timeZone: v.optional(v.string()),
    every: v.optional(v.number()),
    unit: v.optional(intervalUnit),
    repeat: v.optional(repeatMode),
    times: v.optional(v.number()),
    tags: v.array(v.string()),
  },
  handler: async (ctx, { userId, ...a }) =>
    await inEnglish(async () => {
      const timeZone = a.timeZone?.trim() || (await defaultTimeZone(ctx, userId));
      if (!isValidTimeZone(timeZone)) throw new ConvexError("invalidTimeZone");
      const repeat = a.repeat ?? (a.times !== undefined ? "count" : a.every !== undefined || a.unit !== undefined ? "forever" : "once");
      const id = await insertReminder(ctx, userId, {
        title: a.title,
        message: a.message?.trim() ? a.message : a.title,
        note: a.note,
        tagIds: await tagIdsByName(ctx, userId, a.tags),
        intervalCount: a.every ?? 1,
        intervalUnit: a.unit ?? "days",
        repeatMode: repeat,
        repeatTimes: a.times,
        startAt: a.startAt ? parseStart(a.startAt, timeZone) : Date.now(),
        timeZone,
      });
      return await present(ctx, (await ctx.db.get("reminders", id))!);
    }),
});

export const snoozeReminder = internalMutation({
  args: { userId: v.id("users"), id: v.string(), minutes: v.number() },
  handler: async (ctx, { userId, id, minutes }) =>
    await inEnglish(async () => {
      const reminder = await ownedReminder(ctx, userId, id);
      if (reminder.status !== "active") {
        throw new ConvexError(`"${reminder.title}" is ${reminder.status}; only an active reminder can be snoozed.`);
      }
      // Snooze repeats a notification that was sent; before the first one it
      // would only pull the start earlier.
      if (reminder.lastFiredAt === undefined) {
        throw new ConvexError(`"${reminder.title}" hasn't sent a notification yet, so there is nothing to snooze. Its first one is at ${new Date(reminder.nextFireAt).toISOString()}.`);
      }
      // The fire after this one steps from the snoozed time to the schedule's
      // next regular time, skipping any that passed meanwhile (fire.ts).
      await ctx.db.patch("reminders", reminder._id, { nextFireAt: Date.now() + minutes * 60_000 });
      await reschedule(ctx, reminder._id);
      return await present(ctx, (await ctx.db.get("reminders", reminder._id))!);
    }),
});

export const setActive = internalMutation({
  args: { userId: v.id("users"), id: v.string(), active: v.boolean() },
  handler: async (ctx: MutationCtx, { userId, id, active }) =>
    await inEnglish(async () => {
      const reminder = await ownedReminder(ctx, userId, id);
      await setReminderActive(ctx, reminder, active);
      return await present(ctx, (await ctx.db.get("reminders", reminder._id))!);
    }),
});

const clamp = (n: unknown, fallback: number, max: number) => Math.min(Math.max(Math.trunc(Number(n ?? fallback)), 1), max);

const ID_INPUT = { type: "string", description: "The reminder's id, from list_upcoming or search_reminders." } as const;

export const tools: KunjiTool[] = [
  {
    name: "list_upcoming",
    description:
      "List the user's active Yaad Dila reminders (repeating push reminders), soonest next notification first: title, message, schedule, next time (ISO and in the reminder's own time zone), times already sent and tags. Paused and finished reminders are not included.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", description: "At most this many reminders (default 10, max 50)." },
        withinHours: { type: "number", description: "Only reminders due within this many hours from now." },
      },
      additionalProperties: false,
    },
    handler: async (ctx, userId, input) =>
      await ctx.runQuery(internal.kunji.listUpcoming, {
        userId,
        limit: clamp(input.limit, 10, 50),
        withinHours: input.withinHours === undefined ? undefined : Math.max(Number(input.withinHours), 0),
      }),
  },
  {
    name: "search_reminders",
    description:
      "Search all of the user's Yaad Dila reminders (active, paused and finished) by words in the title, message or note; the last word matches as a prefix. Best match first. Returns each reminder's id, which other tools take.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Words to look for, e.g. \"water\" or \"rent\"." },
        status: { type: "string", enum: ["active", "paused", "finished"], description: "Only reminders with this status." },
        limit: { type: "integer", description: "At most this many reminders (default 10, max 25)." },
      },
      required: ["query"],
      additionalProperties: false,
    },
    handler: async (ctx, userId, input) =>
      await ctx.runQuery(internal.kunji.searchReminders, {
        userId,
        query: String(input.query),
        status: input.status as Doc<"reminders">["status"] | undefined,
        limit: clamp(input.limit, 10, 25),
      }),
  },
  {
    name: "add_reminder",
    description:
      "Create a Yaad Dila reminder: a push notification on the user's phone, once or repeating every N minutes, hours, days, weeks or months, forever or a set number of times. Day, week and month steps keep the same local time in the reminder's time zone. Returns the new reminder.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short title, shown as the notification's title." },
        message: { type: "string", description: "The notification's text (defaults to the title)." },
        note: { type: "string", description: "Optional longer note, shown only in the app." },
        startAt: {
          type: "string",
          description:
            "First notification, ISO 8601. Without an offset (2026-11-01T09:00) it is read in timeZone. Defaults to now. Later repeats are counted from this time.",
        },
        timeZone: {
          type: "string",
          description: "IANA zone, e.g. Asia/Kolkata. Defaults to the zone of the user's newest reminder, else UTC.",
        },
        every: { type: "integer", description: "Repeat every this many units (1–1000, default 1)." },
        unit: { type: "string", enum: ["minutes", "hours", "days", "weeks", "months"], description: "Default days." },
        repeat: {
          type: "string",
          enum: ["once", "forever", "count"],
          description: "once, forever, or count (then give times). Defaults to count if times is given, forever if every or unit is, else once.",
        },
        times: { type: "integer", description: "How many notifications in all, for repeat count (1–10000)." },
        tags: { type: "string", description: "Comma-separated names of the user's existing tags." },
      },
      required: ["title"],
      additionalProperties: false,
    },
    handler: async (ctx, userId, input) => {
      const opt = (key: string) => (input[key] === undefined ? undefined : String(input[key]));
      return await ctx.runMutation(internal.kunji.addReminder, {
        userId,
        title: String(input.title),
        message: opt("message"),
        note: opt("note"),
        startAt: opt("startAt"),
        timeZone: opt("timeZone"),
        every: input.every as number | undefined,
        unit: input.unit as Doc<"reminders">["intervalUnit"] | undefined,
        repeat: input.repeat as Doc<"reminders">["repeatMode"] | undefined,
        times: input.times as number | undefined,
        tags: (opt("tags") ?? "").split(",").map((t) => t.trim()).filter(Boolean),
      });
    },
  },
  {
    name: "snooze_reminder",
    description:
      "Snooze an active Yaad Dila reminder that has already sent a notification (\"remind me again in N minutes\"): its next notification comes in this many minutes instead, then the regular schedule continues (regular times that pass during the snooze are skipped). For a reminder set to a number of times, the snoozed notification counts as one of them.",
    inputSchema: {
      type: "object",
      properties: { id: ID_INPUT, minutes: { type: "integer", description: "Minutes from now (1–1440)." } },
      required: ["id", "minutes"],
      additionalProperties: false,
    },
    handler: async (ctx, userId, input) => {
      const minutes = Number(input.minutes);
      if (minutes < 1 || minutes > 1440) throw new ConvexError("\"minutes\" must be from 1 to 1440.");
      return await ctx.runMutation(internal.kunji.snoozeReminder, { userId, id: String(input.id), minutes });
    },
  },
  {
    name: "set_reminder_active",
    description:
      "Pause (active: false) or resume (active: true) a Yaad Dila reminder, like its switch in the app. Resuming skips the times missed while paused. A finished reminder can't be resumed.",
    inputSchema: {
      type: "object",
      properties: { id: ID_INPUT, active: { type: "boolean", description: "true to resume, false to pause." } },
      required: ["id", "active"],
      additionalProperties: false,
    },
    handler: async (ctx, userId, input) =>
      await ctx.runMutation(internal.kunji.setActive, { userId, id: String(input.id), active: input.active === true }),
  },
];
