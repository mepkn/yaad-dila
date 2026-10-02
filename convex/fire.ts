import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { sendPush } from "./lib/expoPush";
import { scheduleRun } from "./lib/scheduling";
import { isExhausted, nextAfterFire } from "./lib/schedule";
import { MAX_TOKENS_PER_USER, deleteTokens } from "./pushTokens";

export const NO_DEVICES_ERROR = "noDevices";

// Scheduled with ctx.scheduler.runAt(fireAt). Sends the push, then records the
// outcome and schedules the next run.
export const fire = internalAction({
  args: { reminderId: v.id("reminders"), fireAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const prepared = await ctx.runQuery(internal.fire.prepare, args);
    if (prepared === null) return null;

    let error: string | undefined;
    let unregisteredTokens: string[] = [];
    if (prepared.tokens.length === 0) {
      error = NO_DEVICES_ERROR;
    } else {
      const result = await sendPush(prepared.tokens, {
        title: prepared.title,
        body: prepared.message,
        data: { reminderId: args.reminderId },
      });
      unregisteredTokens = result.unregisteredTokens;
      if (result.delivered === 0) error = result.error ?? NO_DEVICES_ERROR;
    }

    await ctx.runMutation(internal.fire.recordFire, {
      ...args,
      error,
      unregisteredTokens,
    });
    return null;
  },
});

// Returns what to send, or null if this run is stale (the reminder was
// deleted, paused or rescheduled after the run was queued).
export const prepare = internalQuery({
  args: { reminderId: v.id("reminders"), fireAt: v.number() },
  returns: v.union(
    v.null(),
    v.object({
      title: v.string(),
      message: v.string(),
      tokens: v.array(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const reminder = await ctx.db.get("reminders", args.reminderId);
    if (reminder === null || !reminder.active) return null;
    if (reminder.nextFireAt !== args.fireAt) return null;
    const tokens = await ctx.db
      .query("pushTokens")
      .withIndex("by_userId", (q) => q.eq("userId", reminder.userId))
      .take(MAX_TOKENS_PER_USER);
    return {
      title: reminder.title,
      message: reminder.message,
      tokens: tokens.map((t) => t.token),
    };
  },
});

export const recordFire = internalMutation({
  args: {
    reminderId: v.id("reminders"),
    fireAt: v.number(),
    error: v.optional(v.string()),
    unregisteredTokens: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await deleteTokens(ctx, args.unregisteredTokens);

    const reminder = await ctx.db.get("reminders", args.reminderId);
    if (reminder === null || !reminder.active) return null;
    if (reminder.nextFireAt !== args.fireAt) return null;

    const now = Date.now();
    const firedCount = reminder.firedCount + 1;
    const base = { firedCount, lastFiredAt: now, lastError: args.error };

    if (isExhausted(reminder, firedCount)) {
      await ctx.db.patch("reminders", reminder._id, {
        ...base,
        active: false,
        scheduledFnId: undefined,
      });
      return null;
    }

    const nextFireAt = nextAfterFire(reminder, args.fireAt, now);
    const scheduledFnId = await scheduleRun(ctx, reminder._id, nextFireAt);
    await ctx.db.patch("reminders", reminder._id, {
      ...base,
      nextFireAt,
      scheduledFnId,
    });
    return null;
  },
});
