import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { getOwnedTag, requireUserId } from "./lib/access";

const MAX_TAGS = 200;
// Join rows cleaned up per transaction after a tag is deleted.
const REMOVE_BATCH = 100;

function normaliseName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (trimmed.length === 0) throw new ConvexError("tagNameRequired");
  if (trimmed.length > 50) throw new ConvexError("tagNameTooLong");
  return trimmed;
}

// Names are unique per user ignoring case ("Water" and "water" clash). A user
// has at most MAX_TAGS tags, so scanning them through the index is bounded.
async function assertNameFree(
  ctx: MutationCtx,
  userId: Id<"users">,
  name: string,
  except?: Id<"tags">,
): Promise<void> {
  const wanted = name.toLocaleLowerCase();
  const tags = await ctx.db
    .query("tags")
    .withIndex("by_userId_and_name", (q) => q.eq("userId", userId))
    .take(MAX_TAGS);
  const clash = tags.find((t) => t._id !== except && t.name.toLocaleLowerCase() === wanted);
  if (clash) throw new ConvexError("tagNameTaken");
}

export const list = query({
  args: {},
  returns: v.array(
    v.object({ _id: v.id("tags"), name: v.string(), reminderCount: v.number() }),
  ),
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const tags = await ctx.db
      .query("tags")
      .withIndex("by_userId_and_name", (q) => q.eq("userId", userId))
      .take(MAX_TAGS);
    return tags.map((tag) => ({
      _id: tag._id,
      name: tag.name,
      reminderCount: tag.reminderCount,
    }));
  },
});

export const create = mutation({
  args: { name: v.string() },
  returns: v.id("tags"),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const name = normaliseName(args.name);
    await assertNameFree(ctx, userId, name);
    const count = await ctx.db
      .query("tags")
      .withIndex("by_userId_and_name", (q) => q.eq("userId", userId))
      .take(MAX_TAGS);
    if (count.length >= MAX_TAGS) throw new ConvexError("tooManyTags");
    return await ctx.db.insert("tags", { userId, name, reminderCount: 0 });
  },
});

export const rename = mutation({
  args: { id: v.id("tags"), name: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const tag = await getOwnedTag(ctx, userId, args.id);
    const name = normaliseName(args.name);
    await assertNameFree(ctx, userId, name, tag._id);
    await ctx.db.patch("tags", tag._id, { name });
    return null;
  },
});

// Removes up to REMOVE_BATCH of a deleted tag's join rows, and the tag from
// those reminders. Returns whether there may be more.
async function removeLinksBatch(ctx: MutationCtx, tagId: Id<"tags">): Promise<boolean> {
  const links = await ctx.db
    .query("reminderTags")
    .withIndex("by_tagId", (q) => q.eq("tagId", tagId))
    .take(REMOVE_BATCH);
  for (const link of links) {
    const reminder = await ctx.db.get("reminders", link.reminderId);
    if (reminder !== null) {
      await ctx.db.patch("reminders", reminder._id, {
        tagIds: reminder.tagIds.filter((id) => id !== tagId),
      });
    }
    await ctx.db.delete("reminderTags", link._id);
  }
  return links.length === REMOVE_BATCH;
}

// Deletes the tag and removes it from every reminder that uses it. The first
// batch runs here; any rest continue in scheduled batches.
export const remove = mutation({
  args: { id: v.id("tags") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const tag = await getOwnedTag(ctx, userId, args.id);
    await ctx.db.delete("tags", tag._id);
    if (await removeLinksBatch(ctx, tag._id)) {
      await ctx.scheduler.runAfter(0, internal.tags.removeLinks, { tagId: tag._id });
    }
    return null;
  },
});

export const removeLinks = internalMutation({
  args: { tagId: v.id("tags") },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (await removeLinksBatch(ctx, args.tagId)) {
      await ctx.scheduler.runAfter(0, internal.tags.removeLinks, args);
    }
    return null;
  },
});
