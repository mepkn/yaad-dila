import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

// Every reminderTags insert and delete goes through these, so
// tags.reminderCount stays equal to the tag's join rows without counting them.

async function bump(ctx: MutationCtx, tagId: Id<"tags">, delta: number): Promise<void> {
  const tag = await ctx.db.get("tags", tagId);
  // A deleted tag's rows are cleaned up after it's gone; nothing to count.
  if (tag !== null) {
    await ctx.db.patch("tags", tagId, { reminderCount: tag.reminderCount + delta });
  }
}

export async function addTagLink(
  ctx: MutationCtx,
  userId: Id<"users">,
  reminderId: Id<"reminders">,
  tagId: Id<"tags">,
): Promise<void> {
  await ctx.db.insert("reminderTags", { userId, reminderId, tagId });
  await bump(ctx, tagId, 1);
}

export async function removeTagLink(
  ctx: MutationCtx,
  link: { _id: Id<"reminderTags">; tagId: Id<"tags"> },
): Promise<void> {
  await ctx.db.delete("reminderTags", link._id);
  await bump(ctx, link.tagId, -1);
}
