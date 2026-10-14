import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const intervalUnit = v.union(
  v.literal("minutes"),
  v.literal("hours"),
  v.literal("days"),
  v.literal("weeks"),
  v.literal("months"),
);

export const repeatMode = v.union(
  v.literal("once"),
  v.literal("forever"),
  v.literal("count"),
);

export const reminderStatus = v.union(
  v.literal("active"),
  v.literal("paused"),
  v.literal("finished"), // ran out of fires; editing the schedule can restart it
);

export default defineSchema({
  ...authTables,

  reminders: defineTable({
    userId: v.id("users"),
    title: v.string(),
    message: v.string(),
    note: v.optional(v.string()),
    tagIds: v.array(v.id("tags")),
    intervalCount: v.number(),
    intervalUnit,
    repeatMode,
    repeatTimes: v.optional(v.number()),
    // IANA zone of the device that saved the reminder. Day/week/month steps
    // follow this zone's calendar; minute/hour steps are exact durations.
    timeZone: v.string(),
    firedCount: v.number(),
    startAt: v.number(),
    nextFireAt: v.number(),
    lastFiredAt: v.optional(v.number()),
    status: reminderStatus,
    // title, message and note, kept in step on every save for the search index.
    searchText: v.string(),
    lastError: v.optional(v.string()),
    scheduledFnId: v.optional(v.id("_scheduled_functions")),
  })
    .index("by_userId_and_status_and_nextFireAt", ["userId", "status", "nextFireAt"])
    .searchIndex("search_text", { searchField: "searchText", filterFields: ["userId"] }),

  tags: defineTable({
    userId: v.id("users"),
    name: v.string(),
    reminderCount: v.number(), // its reminderTags rows, kept by lib/tagLinks.ts
  }).index("by_userId_and_name", ["userId", "name"]),

  // Join table mirroring reminders.tagIds so tag counts and tag deletion are
  // index lookups instead of scans over a user's reminders.
  reminderTags: defineTable({
    userId: v.id("users"),
    reminderId: v.id("reminders"),
    tagId: v.id("tags"),
  })
    .index("by_reminderId", ["reminderId"])
    .index("by_tagId", ["tagId"]),

  pushTokens: defineTable({
    userId: v.id("users"),
    token: v.string(),
    deviceName: v.string(),
  })
    .index("by_userId", ["userId"])
    .index("by_token", ["token"]),
});
