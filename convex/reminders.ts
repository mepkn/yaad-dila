import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { getOwnedReminder, getOwnedTag, requireUserId } from "./lib/access";
import { cancelPendingRun, reschedule } from "./lib/scheduling";
import {
  isValidTimeZone,
  nextFromNow,
  statusAfter,
  type ScheduleSpec,
} from "./lib/schedule";
import { addTagLink, removeTagLink } from "./lib/tagLinks";
import schema, { intervalUnit, repeatMode, reminderStatus } from "./schema";

const MAX_TAGS_PER_REMINDER = 20;

const reminderFields = v.object({
  title: v.string(),
  message: v.string(),
  note: v.optional(v.string()),
  tagIds: v.array(v.id("tags")),
  intervalCount: v.number(),
  intervalUnit,
  repeatMode,
  repeatTimes: v.optional(v.number()),
  startAt: v.number(),
  timeZone: v.string(),
});

type ReminderInput = typeof reminderFields.type;

const reminderDoc = schema.doc("reminders");

const searchText = (f: { title: string; message: string; note?: string }) =>
  [f.title, f.message, f.note ?? ""].join("\n");

function isPositiveInt(n: number, max: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= max;
}

function requiredText(value: string, field: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new ConvexError(`${field}Required`);
  if (trimmed.length > max) throw new ConvexError(`${field}TooLong`);
  return trimmed;
}

// Validates and normalises client input into the stored schedule fields.
async function normalise(
  ctx: MutationCtx,
  userId: Id<"users">,
  input: ReminderInput,
) {
  const title = requiredText(input.title, "title", 200);
  const message = requiredText(input.message, "message", 1000);
  const note = input.note?.trim() ? input.note.trim().slice(0, 5000) : undefined;

  if (!isPositiveInt(input.intervalCount, 1000)) {
    throw new ConvexError("invalidIntervalCount");
  }
  if (input.repeatMode === "count") {
    if (input.repeatTimes === undefined || !isPositiveInt(input.repeatTimes, 10000)) {
      throw new ConvexError("invalidRepeatTimes");
    }
  }
  if (!Number.isFinite(input.startAt) || input.startAt < 0) {
    throw new ConvexError("invalidStartAt");
  }
  if (!isValidTimeZone(input.timeZone)) {
    throw new ConvexError("invalidTimeZone");
  }

  const tagIds = [...new Set(input.tagIds)];
  if (tagIds.length > MAX_TAGS_PER_REMINDER) throw new ConvexError("tooManyTags");
  for (const tagId of tagIds) await getOwnedTag(ctx, userId, tagId);

  return {
    title,
    message,
    note,
    tagIds,
    intervalCount: input.intervalCount,
    intervalUnit: input.intervalUnit,
    repeatMode: input.repeatMode,
    repeatTimes: input.repeatMode === "count" ? input.repeatTimes : undefined,
    startAt: input.startAt,
    timeZone: input.timeZone,
  };
}

// Keeps the reminderTags join rows in step with reminder.tagIds.
async function syncReminderTags(
  ctx: MutationCtx,
  userId: Id<"users">,
  reminderId: Id<"reminders">,
  tagIds: Id<"tags">[],
): Promise<void> {
  const wanted = new Set(tagIds);
  const existing = await ctx.db
    .query("reminderTags")
    .withIndex("by_reminderId", (q) => q.eq("reminderId", reminderId))
    .take(MAX_TAGS_PER_REMINDER + 1);
  for (const row of existing) {
    if (wanted.has(row.tagId)) wanted.delete(row.tagId);
    else await removeTagLink(ctx, row);
  }
  for (const tagId of wanted) {
    await addTagLink(ctx, userId, reminderId, tagId);
  }
}

// One status, paginated. Active and paused come soonest next fire first;
// finished comes most recently finished first.
export const list = query({
  args: { status: reminderStatus, paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(reminderDoc),
  handler: async (ctx, { status, paginationOpts }) => {
    const userId = await requireUserId(ctx);
    return await ctx.db
      .query("reminders")
      .withIndex("by_userId_and_status_and_nextFireAt", (q) =>
        q.eq("userId", userId).eq("status", status),
      )
      .order(status === "finished" ? "desc" : "asc")
      .paginate(paginationOpts);
  },
});

// Every reminder with the tag, in any status, most recently tagged first.
// Pages through the reminderTags join rows.
export const byTag = query({
  args: { tagId: v.id("tags"), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(reminderDoc),
  handler: async (ctx, { tagId, paginationOpts }) => {
    const userId = await requireUserId(ctx);
    const tag = await getOwnedTag(ctx, userId, tagId);
    const result = await ctx.db
      .query("reminderTags")
      .withIndex("by_tagId", (q) => q.eq("tagId", tag._id))
      .order("desc")
      .paginate(paginationOpts);
    const page: Doc<"reminders">[] = [];
    for (const link of result.page) {
      const reminder = await ctx.db.get("reminders", link.reminderId);
      if (reminder !== null && reminder.userId === userId) page.push(reminder);
    }
    return { ...result, page };
  },
});

// All of the caller's reminders in every status, by title, message and note
// words (the last word matches as a prefix), best match first.
export const search = query({
  args: { query: v.string(), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(reminderDoc),
  handler: async (ctx, { query: text, paginationOpts }) => {
    const userId = await requireUserId(ctx);
    const trimmed = text.trim();
    if (!trimmed) return { page: [], isDone: true, continueCursor: "" };
    return await ctx.db
      .query("reminders")
      .withSearchIndex("search_text", (q) => q.search("searchText", trimmed).eq("userId", userId))
      .paginate(paginationOpts);
  },
});

export const get = query({
  args: { id: v.id("reminders") },
  returns: v.union(v.null(), reminderDoc),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const reminder = await ctx.db.get("reminders", args.id);
    if (reminder === null || reminder.userId !== userId) return null;
    return reminder;
  },
});

export const create = mutation({
  args: reminderFields.fields,
  returns: v.id("reminders"),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const fields = await normalise(ctx, userId, args);
    const id = await ctx.db.insert("reminders", {
      ...fields,
      userId,
      searchText: searchText(fields),
      firedCount: 0,
      nextFireAt: nextFromNow(fields, Date.now()),
      status: "active",
    });
    await syncReminderTags(ctx, userId, id, fields.tagIds);
    await reschedule(ctx, id);
    return id;
  },
});

export const update = mutation({
  args: { id: v.id("reminders"), ...reminderFields.fields },
  returns: v.null(),
  handler: async (ctx, { id, ...input }) => {
    const userId = await requireUserId(ctx);
    const reminder = await getOwnedReminder(ctx, userId, id);
    const fields = await normalise(ctx, userId, input);
    const spec: ScheduleSpec = fields;
    // A paused reminder stays paused; one with no fires left becomes finished.
    // A finished reminder whose new schedule allows more fires restarts.
    const status = statusAfter(spec, reminder.firedCount, reminder.status !== "paused");
    await ctx.db.patch("reminders", id, {
      ...fields,
      searchText: searchText(fields),
      nextFireAt: nextFromNow(spec, Date.now()),
      status,
    });
    await syncReminderTags(ctx, userId, id, fields.tagIds);
    await reschedule(ctx, id);
    return null;
  },
});

export const setActive = mutation({
  args: { id: v.id("reminders"), active: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const reminder = await getOwnedReminder(ctx, userId, args.id);
    if (reminder.status === "finished") {
      if (args.active) throw new ConvexError("reminderFinished");
      return null;
    }
    if ((reminder.status === "active") === args.active) return null;
    if (args.active) {
      // Resume skips any fire times missed while paused.
      await ctx.db.patch("reminders", reminder._id, {
        status: "active",
        nextFireAt: nextFromNow(reminder, Date.now()),
      });
    } else {
      await ctx.db.patch("reminders", reminder._id, { status: "paused" });
    }
    await reschedule(ctx, reminder._id);
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("reminders") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const reminder: Doc<"reminders"> = await getOwnedReminder(ctx, userId, args.id);
    await cancelPendingRun(ctx, reminder);
    await syncReminderTags(ctx, userId, reminder._id, []);
    await ctx.db.delete("reminders", reminder._id);
    return null;
  },
});
