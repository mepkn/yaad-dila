/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as fire from "../fire.js";
import type * as http from "../http.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_expoPush from "../lib/expoPush.js";
import type * as lib_schedule from "../lib/schedule.js";
import type * as lib_scheduling from "../lib/scheduling.js";
import type * as pushTokens from "../pushTokens.js";
import type * as reminders from "../reminders.js";
import type * as tags from "../tags.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  fire: typeof fire;
  http: typeof http;
  "lib/access": typeof lib_access;
  "lib/expoPush": typeof lib_expoPush;
  "lib/schedule": typeof lib_schedule;
  "lib/scheduling": typeof lib_scheduling;
  pushTokens: typeof pushTokens;
  reminders: typeof reminders;
  tags: typeof tags;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
