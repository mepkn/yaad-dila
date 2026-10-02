import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  type MutationCtx,
} from "./_generated/server";
import { requireUserId } from "./lib/access";
import { sendPush } from "./lib/expoPush";

export const MAX_TOKENS_PER_USER = 20;

const EXPO_TOKEN = /^Expo(nent)?PushToken\[[^\]]+\]$/;

export async function deleteTokens(
  ctx: MutationCtx,
  tokens: string[],
): Promise<void> {
  for (const token of tokens) {
    const rows = await ctx.db
      .query("pushTokens")
      .withIndex("by_token", (q) => q.eq("token", token))
      .take(10);
    for (const row of rows) await ctx.db.delete("pushTokens", row._id);
  }
}

// Registers this device's token for the signed-in user. A token belongs to
// one device, so it moves to whoever signed in on it last.
export const register = mutation({
  args: { token: v.string(), deviceName: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    if (!EXPO_TOKEN.test(args.token)) throw new ConvexError("invalidPushToken");
    const deviceName = args.deviceName.trim().slice(0, 100) || "Unknown device";

    const existing = await ctx.db
      .query("pushTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .take(10);
    for (const row of existing) {
      if (row.userId === userId) {
        await ctx.db.patch("pushTokens", row._id, { deviceName });
        return null;
      }
      await ctx.db.delete("pushTokens", row._id);
    }

    const mine = await ctx.db
      .query("pushTokens")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(MAX_TOKENS_PER_USER);
    if (mine.length >= MAX_TOKENS_PER_USER) {
      // Drop the oldest device rather than refusing the newest.
      await ctx.db.delete("pushTokens", mine[0]._id);
    }
    await ctx.db.insert("pushTokens", { userId, token: args.token, deviceName });
    return null;
  },
});

export const unregister = mutation({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("pushTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .take(10);
    for (const row of rows) {
      if (row.userId === userId) await ctx.db.delete("pushTokens", row._id);
    }
    return null;
  },
});

export const tokensForCurrentUser = internalQuery({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("pushTokens")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(MAX_TOKENS_PER_USER);
    return rows.map((r) => r.token);
  },
});

export const removeTokens = internalMutation({
  args: { tokens: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await deleteTokens(ctx, args.tokens);
    return null;
  },
});

// Sends a test notification to all of the user's devices through Expo push.
export const sendTest = action({
  args: { title: v.string(), message: v.string() },
  returns: v.object({ delivered: v.number(), error: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const tokens: string[] = await ctx.runQuery(
      internal.pushTokens.tokensForCurrentUser,
      {},
    );
    if (tokens.length === 0) return { delivered: 0, error: "noDevices" };
    const result = await sendPush(tokens, {
      title: args.title.slice(0, 200),
      body: args.message.slice(0, 1000),
      data: {},
    });
    if (result.unregisteredTokens.length > 0) {
      await ctx.runMutation(internal.pushTokens.removeTokens, {
        tokens: result.unregisteredTokens,
      });
    }
    return { delivered: result.delivered, error: result.error };
  },
});
