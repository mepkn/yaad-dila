import { defineApp } from "convex/server";
import { v } from "convex/values";

// Optional: set when "Enhanced security for push notifications" is enabled
// for the Expo project.
const app = defineApp({
  env: { EXPO_ACCESS_TOKEN: v.optional(v.string()) },
});

export default app;
