import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalQuery } from "./_generated/server";
import { requireUserId } from "./lib/access";
import { generate, KunjiError } from "./lib/kunji";
import { isValidTimeZone } from "./lib/schedule";
import { draftSchema, systemPrompt, toDraft } from "./lib/voice";

// Voice reminders: the device recognises speech and sends the text here; kunji's
// gateway asks the user's own AI key (saved at kunji.pknspace.com, found by the
// user's email) for the reminder fields. suchna holds no AI keys.

export const callerEmail = internalQuery({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return (await ctx.db.get("users", userId))!.email!;
  },
});

const draft = v.object({
  title: v.string(),
  message: v.string(),
  note: v.optional(v.string()),
  intervalCount: v.number(),
  intervalUnit: v.union(v.literal("minutes"), v.literal("hours"), v.literal("days"), v.literal("weeks"), v.literal("months")),
  repeatMode: v.union(v.literal("once"), v.literal("forever"), v.literal("count")),
  repeatTimes: v.optional(v.number()),
  startAt: v.number(),
});

// kunji's error codes → the app's i18n codes (voice.errors.*).
const ERRORS: Record<KunjiError["code"], string> = {
  no_key: "noAiKey",
  key_refused: "aiKeyRefused",
  rate_limited: "aiRateLimited",
  unauthorized: "notConnected",
  bad_request: "aiUnavailable",
  provider_error: "aiUnavailable",
};

export const parse = action({
  args: { text: v.string(), timeZone: v.string() },
  returns: draft,
  handler: async (ctx, { text, timeZone }) => {
    const userEmail = await ctx.runQuery(internal.voice.callerEmail, {});
    const request = text.trim();
    if (request.length < 3 || request.length > 1000) throw new ConvexError("unparseable");
    if (!isValidTimeZone(timeZone)) throw new ConvexError("invalidTimeZone");
    let reply;
    try {
      reply = await generate({
        userEmail,
        model: "fast",
        system: systemPrompt(Date.now(), timeZone),
        messages: [{ role: "user", content: request }],
        json: draftSchema,
        maxTokens: 500,
        temperature: 0,
      });
    } catch (err) {
      if (err instanceof KunjiError) {
        if (err.code === "unauthorized") console.error("kunji refused suchna's secret:", err.message);
        throw new ConvexError(ERRORS[err.code]);
      }
      throw new ConvexError("aiUnavailable");
    }
    let raw = reply.json;
    if (raw === undefined) {
      try {
        raw = JSON.parse(reply.text);
      } catch {
        raw = null;
      }
    }
    const result = toDraft(raw, timeZone);
    if (result === null) throw new ConvexError("unparseable");
    return result;
  },
});
