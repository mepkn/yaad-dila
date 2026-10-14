import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query } from "./_generated/server";

export const me = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({ _id: v.id("users"), email: v.optional(v.string()) }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get("users", userId);
    if (user === null) return null;
    return { _id: user._id, email: user.email };
  },
});
