/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { checkInput, secretMatches } from "./lib/kunji";

const modules = import.meta.glob("./**/*.ts");
const SECRET = "kjs_test-secret";
const ME = "me@example.com";
const NOW = Date.UTC(2026, 9, 31, 9, 0); // Sat 31 Oct 2026, 09:00 UTC
const HOUR = 3_600_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.stubEnv("KUNJI_SECRET", SECRET);
  vi.stubEnv("ALLOWED_EMAILS", ME);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

type Status = "active" | "paused" | "finished";

async function setup() {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email: ME, emailVerificationTime: 1 });
    // An unverified sign-up with someone else's email must never count.
    await ctx.db.insert("users", { email: "other@example.com" });
    const tag = await ctx.db.insert("tags", { userId, name: "health", reminderCount: 1 });
    const reminder = (title: string, status: Status, nextFireAt: number, extra: { tagIds?: Id<"tags">[] } = {}) =>
      ctx.db.insert("reminders", {
        userId,
        title,
        message: `${title}!`,
        tagIds: [],
        intervalCount: 2,
        intervalUnit: "hours",
        repeatMode: "count",
        repeatTimes: 5,
        timeZone: "Asia/Kolkata",
        firedCount: 1,
        lastFiredAt: NOW,
        startAt: NOW - 2 * HOUR,
        nextFireAt,
        status,
        searchText: `${title}\n${title}!\n`,
        ...extra,
      });
    await ctx.db.insert("tags", { userId, name: "Home", reminderCount: 0 });
    await reminder("Drink water", "active", NOW + 2 * HOUR, { tagIds: [tag] });
    await reminder("Pay rent", "active", NOW + 48 * HOUR);
    await reminder("Water plants", "paused", NOW + HOUR);
    await reminder("Old water", "finished", NOW - HOUR);
  });
  return t;
}

const post = (body: unknown, secret = SECRET) => ({
  method: "POST",
  headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

async function call(t: Awaited<ReturnType<typeof setup>>, tool: string, input: unknown = {}, userEmail = ME) {
  const res = await t.fetch("/kunji/call", post({ tool, input, userEmail }));
  expect(res.status).toBe(200);
  return await res.json();
}

const titles = (result: { title: string }[]) => result.map((r) => r.title);

describe("secret check", () => {
  it("compares exactly", async () => {
    expect(await secretMatches(SECRET, SECRET)).toBe(true);
    expect(await secretMatches(SECRET + "x", SECRET)).toBe(false);
    expect(await secretMatches("", "")).toBe(false);
  });

  it.each([
    ["GET", "/kunji/tools"],
    ["POST", "/kunji/access"],
    ["POST", "/kunji/call"],
  ])("%s %s refuses a wrong or missing secret", async (method, path) => {
    const t = await setup();
    const body = method === "POST" ? JSON.stringify({ userEmail: ME, tool: "list_upcoming" }) : undefined;
    expect((await t.fetch(path, { method, headers: { Authorization: "Bearer nope" }, body })).status).toBe(401);
    expect((await t.fetch(path, { method, body })).status).toBe(401);
  });

  it("refuses everything when KUNJI_SECRET is unset", async () => {
    vi.stubEnv("KUNJI_SECRET", "");
    const t = await setup();
    expect((await t.fetch("/kunji/tools", { headers: { Authorization: "Bearer " } })).status).toBe(401);
  });
});

describe("GET /kunji/tools", () => {
  it("lists the tools with their schemas", async () => {
    const t = await setup();
    const res = await t.fetch("/kunji/tools", { headers: { Authorization: `Bearer ${SECRET}` } });
    const tools = (await res.json()) as { name: string; inputSchema: { type: string } }[];
    expect(tools.map((x) => x.name)).toEqual(["list_upcoming", "search_reminders", "add_reminder", "snooze_reminder", "set_reminder_active"]);
    expect(tools.every((x) => x.inputSchema.type === "object" && /^[a-z][a-z0-9_]{0,63}$/.test(x.name))).toBe(true);
  });
});

describe("POST /kunji/access", () => {
  it.each([
    [ME, "ok"],
    ["ME@Example.com ", "ok"],
    ["nobody@example.com", "no_account"],
    ["other@example.com", "no_account"], // unverified
  ])("%s → %s", async (userEmail, status) => {
    const t = await setup();
    const res = await t.fetch("/kunji/access", post({ userEmail }));
    expect(await res.json()).toEqual({ status });
  });

  it("is not_allowed once the email leaves ALLOWED_EMAILS", async () => {
    const t = await setup();
    vi.stubEnv("ALLOWED_EMAILS", "someone@else.com");
    const res = await t.fetch("/kunji/access", post({ userEmail: ME }));
    expect(await res.json()).toEqual({ status: "not_allowed" });
  });

  it("is no_account when two verified rows share the email", async () => {
    const t = await setup();
    await t.run(async (ctx) => void (await ctx.db.insert("users", { email: ME, emailVerificationTime: 1 })));
    const res = await t.fetch("/kunji/access", post({ userEmail: ME }));
    expect(await res.json()).toEqual({ status: "no_account" });
  });

  it("needs userEmail", async () => {
    const t = await setup();
    expect((await t.fetch("/kunji/access", post({}))).status).toBe(400);
  });
});

describe("POST /kunji/call", () => {
  it("refuses no_account and not_allowed", async () => {
    const t = await setup();
    expect(await call(t, "list_upcoming", {}, "nobody@example.com")).toMatchObject({ ok: false, error: { code: "no_account" } });
    vi.stubEnv("ALLOWED_EMAILS", "someone@else.com");
    expect(await call(t, "list_upcoming")).toMatchObject({ ok: false, error: { code: "not_allowed" } });
  });

  it("refuses unknown tools and bad input", async () => {
    const t = await setup();
    expect(await call(t, "delete_everything")).toMatchObject({ ok: false, error: { code: "unknown_tool" } });
    expect(await call(t, "search_reminders", {})).toMatchObject({ ok: false, error: { code: "bad_input", message: 'Missing "query".' } });
    expect(await call(t, "list_upcoming", { limit: 1.5 })).toMatchObject({ ok: false, error: { code: "bad_input" } });
    expect(await call(t, "search_reminders", { query: "x", status: "gone" })).toMatchObject({ ok: false, error: { code: "bad_input" } });
  });

  it("list_upcoming lists active reminders, soonest first", async () => {
    const t = await setup();
    const { result } = await call(t, "list_upcoming");
    expect(titles(result)).toEqual(["Drink water", "Pay rent"]);
    expect(result[0]).toMatchObject({
      message: "Drink water!",
      status: "active",
      schedule: "every 2 hours, 5 times",
      timesSent: 1,
      nextAt: "2026-10-31T11:00:00.000Z",
      nextLocal: "Sat, 31 Oct 2026, 16:30",
      timeZone: "Asia/Kolkata",
      tags: ["health"],
    });
    expect(titles((await call(t, "list_upcoming", { withinHours: 24 })).result)).toEqual(["Drink water"]);
    expect(titles((await call(t, "list_upcoming", { limit: 1 })).result)).toEqual(["Drink water"]);
  });

  it("search_reminders searches every status, or one", async () => {
    const t = await setup();
    const all = (await call(t, "search_reminders", { query: "water" })).result;
    expect(titles(all).sort()).toEqual(["Drink water", "Old water", "Water plants"]);
    expect(all.find((r: { status: string }) => r.status === "finished")).not.toHaveProperty("nextAt");
    expect(titles((await call(t, "search_reminders", { query: "water", status: "paused" })).result)).toEqual(["Water plants"]);
    expect((await call(t, "search_reminders", { query: "  " })).result).toEqual([]);
  });

  it("add_reminder: a title alone is once, now, in the zone of the newest reminder", async () => {
    const t = await setup();
    const { ok, result } = await call(t, "add_reminder", { title: " Call mum " });
    expect(ok).toBe(true);
    expect(result).toMatchObject({
      title: "Call mum",
      message: "Call mum",
      status: "active",
      schedule: "once",
      nextAt: new Date(NOW).toISOString(),
      timeZone: "Asia/Kolkata",
      tags: [],
    });
    const row = await t.run((ctx) => ctx.db.get("reminders", result.id));
    expect(row?.scheduledFnId).toBeDefined();
  });

  it("add_reminder: a local start time, a repeat and tags", async () => {
    const t = await setup();
    const { result } = await call(t, "add_reminder", {
      title: "Stretch",
      message: "Time to stretch",
      startAt: "2026-11-01T09:00",
      every: 1,
      unit: "days",
      times: 3,
      tags: "Health, home",
    });
    expect(result).toMatchObject({
      schedule: "every day, 3 times",
      nextAt: "2026-11-01T03:30:00.000Z",
      nextLocal: "Sun, 1 Nov 2026, 09:00",
      tags: ["health", "Home"],
    });
    const withOffset = await call(t, "add_reminder", { title: "UTC", startAt: "2026-11-01T09:00Z", timeZone: "Europe/London", every: 2, unit: "weeks" });
    expect(withOffset.result).toMatchObject({ schedule: "every 2 weeks", nextAt: "2026-11-01T09:00:00.000Z", timeZone: "Europe/London" });
  });

  it("add_reminder refuses bad input with a readable message", async () => {
    const t = await setup();
    const err = async (input: object) => (await call(t, "add_reminder", input)).error;
    expect(await err({ title: "  " })).toEqual({ code: "tool_error", message: "The title can't be empty." });
    expect((await err({ title: "x", tags: "work" })).message).toBe('No tag named "work". The user\'s tags: Home, health. Tags are created in the app.');
    expect((await err({ title: "x", startAt: "tomorrow" })).message).toMatch(/Can't read the start time/);
    expect((await err({ title: "x", startAt: "2026-02-30T09:00" })).message).toMatch(/Can't read the start time/);
    expect((await err({ title: "x", timeZone: "Mars/Base" })).message).toMatch(/IANA/);
    expect((await err({ title: "x", times: 0 })).message).toMatch(/"times"/);
    expect(await t.run(async (ctx) => (await ctx.db.query("reminders").collect()).length)).toBe(4);
  });

  async function idOf(t: Awaited<ReturnType<typeof setup>>, title: string) {
    return await t.run(async (ctx) => (await ctx.db.query("reminders").collect()).find((r) => r.title === title)!._id);
  }

  it("snooze_reminder moves the next notification, then the schedule resumes", async () => {
    const t = await setup();
    const id = await idOf(t, "Drink water");
    const { result } = await call(t, "snooze_reminder", { id, minutes: 30 });
    expect(result).toMatchObject({ id, nextAt: new Date(NOW + 30 * 60_000).toISOString() });
    vi.advanceTimersByTime(31 * 60_000);
    await t.finishInProgressScheduledFunctions();
    const row = await t.run((ctx) => ctx.db.get("reminders", id));
    // Fired once more (no devices registered), back on the 2-hourly times.
    expect(row).toMatchObject({ firedCount: 2, nextFireAt: NOW + 2 * HOUR, lastError: "noDevices" });
  });

  it("snooze_reminder refuses inactive, unknown and out-of-range", async () => {
    const t = await setup();
    const paused = await idOf(t, "Water plants");
    expect((await call(t, "snooze_reminder", { id: paused, minutes: 10 })).error.message).toBe('"Water plants" is paused; only an active reminder can be snoozed.');
    expect((await call(t, "snooze_reminder", { id: "nope", minutes: 10 })).error.message).toMatch(/^No such reminder/);
    const fresh = (await call(t, "add_reminder", { title: "Fresh", startAt: "2026-11-02T09:00Z" })).result.id;
    expect((await call(t, "snooze_reminder", { id: fresh, minutes: 10 })).error.message).toMatch(/hasn't sent a notification yet/);
    expect((await call(t, "snooze_reminder", { id: await idOf(t, "Pay rent"), minutes: 0 })).error.message).toMatch(/1 to 1440/);
  });

  it("set_reminder_active pauses and resumes; a finished one stays finished", async () => {
    const t = await setup();
    const id = await idOf(t, "Pay rent");
    expect((await call(t, "set_reminder_active", { id, active: false })).result).toMatchObject({ status: "paused" });
    expect((await t.run((ctx) => ctx.db.get("reminders", id)))?.scheduledFnId).toBeUndefined();
    expect((await call(t, "set_reminder_active", { id, active: true })).result).toMatchObject({ status: "active" });
    expect((await call(t, "set_reminder_active", { id: await idOf(t, "Old water"), active: true })).error.message).toMatch(/has finished/);
  });

  it("never shows another user's reminders", async () => {
    const t = await setup();
    vi.stubEnv("ALLOWED_EMAILS", `${ME},b@example.com`);
    await t.run(async (ctx) => void (await ctx.db.insert("users", { email: "b@example.com", emailVerificationTime: 1 })));
    expect((await call(t, "list_upcoming", {}, "b@example.com")).result).toEqual([]);
    expect((await call(t, "search_reminders", { query: "water" }, "b@example.com")).result).toEqual([]);
    const id = await idOf(t, "Drink water");
    for (const [tool, input] of [["snooze_reminder", { id, minutes: 5 }], ["set_reminder_active", { id, active: false }]] as const) {
      expect(await call(t, tool, input, "b@example.com")).toMatchObject({ ok: false, error: { code: "tool_error", message: expect.stringMatching(/^No such reminder/) } });
    }
    expect((await call(t, "add_reminder", { title: "Mine", tags: "health" }, "b@example.com")).error.message).toMatch(/No tag named/);
    expect(await t.run((ctx) => ctx.db.get("reminders", id))).toMatchObject({ status: "active", nextFireAt: NOW + 2 * HOUR });
  });
});

describe("checkInput", () => {
  const schema = { type: "object", properties: { n: { type: "integer" } }, additionalProperties: false } as const;
  it("checks types and unknown fields", () => {
    expect(checkInput(schema, { n: 2 })).toBeNull();
    expect(checkInput(schema, { n: 2.5 })).toBe('"n" must be an integer.');
    expect(checkInput(schema, { x: 1 })).toBe('Unknown field "x".');
    expect(checkInput(schema, [])).toBe("Input must be a JSON object.");
  });
});
