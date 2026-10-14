import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { isAllowedEmail } from "./allowlist";

export async function requireUserId(ctx: QueryCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new ConvexError("notAuthenticated");
  // Re-checked on every call, so removing an email cuts off existing sessions.
  const user = await ctx.db.get("users", userId);
  if (!isAllowedEmail(user?.email)) throw new ConvexError("notAllowed");
  return userId;
}

// Missing and foreign documents are indistinguishable to the caller.
export async function getOwnedReminder(
  ctx: QueryCtx,
  userId: Id<"users">,
  id: Id<"reminders">,
): Promise<Doc<"reminders">> {
  const reminder = await ctx.db.get("reminders", id);
  if (reminder === null || reminder.userId !== userId) {
    throw new ConvexError("reminderNotFound");
  }
  return reminder;
}

export async function getOwnedTag(
  ctx: QueryCtx,
  userId: Id<"users">,
  id: Id<"tags">,
): Promise<Doc<"tags">> {
  const tag = await ctx.db.get("tags", id);
  if (tag === null || tag.userId !== userId) {
    throw new ConvexError("tagNotFound");
  }
  return tag;
}
