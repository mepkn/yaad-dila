import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { advance, newTest, signedInUser, stubExpoPush, type TestConvex } from "./test.helpers";

const MIN = 60_000;
const HOUR = 60 * MIN;
const T0 = Date.UTC(2026, 0, 1, 0, 0);
const TOKEN = "ExponentPushToken[device-1]";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function hourly(overrides: Record<string, unknown> = {}) {
  return {
    title: "Water",
    message: "Drink a glass",
    tagIds: [] as Id<"tags">[],
    intervalCount: 1,
    intervalUnit: "hours" as const,
    repeatMode: "forever" as const,
    startAt: T0 + 10 * MIN,
    timeZone: "UTC",
    ...overrides,
  };
}

async function setup(t: TestConvex) {
  const user = await signedInUser(t, "a@example.com");
  await user.as.mutation(api.pushTokens.register, { token: TOKEN, deviceName: "Pixel" });
  return user;
}

async function getReminder(t: TestConvex, id: Id<"reminders">) {
  const r = await t.run((ctx) => ctx.db.get("reminders", id));
  if (r === null) throw new Error("missing");
  return r;
}

async function pendingJobs(t: TestConvex) {
  return await t.run(async (ctx) =>
    (await ctx.db.system.query("_scheduled_functions").collect()).filter(
      (j) => j.state.kind === "pending",
    ),
  );
}

describe("fire", () => {
  test("sends to every device with channel and reminderId, then advances", async () => {
    const t = newTest();
    const { sent } = stubExpoPush();
    const { as } = await setup(t);
    await as.mutation(api.pushTokens.register, {
      token: "ExpoPushToken[device-2]",
      deviceName: "Tablet",
    });
    const id = await as.mutation(api.reminders.create, hourly());

    await advance(t, 10 * MIN);

    expect(sent).toHaveLength(2);
    expect(sent[0]).toMatchObject({
      title: "Water",
      body: "Drink a glass",
      channelId: "reminders",
      data: { reminderId: id },
    });
    const r = await getReminder(t, id);
    expect(r.firedCount).toBe(1);
    expect(r.lastFiredAt).toBe(T0 + 10 * MIN);
    expect(r.nextFireAt).toBe(T0 + 70 * MIN);
    expect(r.active).toBe(true);
    expect(await pendingJobs(t)).toHaveLength(1);
  });

  test("once fires a single time then becomes finished", async () => {
    const t = newTest();
    const { sent } = stubExpoPush();
    const { as } = await setup(t);
    const id = await as.mutation(api.reminders.create, hourly({ repeatMode: "once" }));

    await advance(t, 10 * MIN);
    await advance(t, 5 * HOUR);

    expect(sent).toHaveLength(1);
    const r = await getReminder(t, id);
    expect(r.firedCount).toBe(1);
    expect(r.active).toBe(false);
    expect(r.scheduledFnId).toBeUndefined();
    expect(await pendingJobs(t)).toHaveLength(0);
  });

  test("count fires repeatTimes times including the first", async () => {
    const t = newTest();
    const { sent } = stubExpoPush();
    const { as } = await setup(t);
    const id = await as.mutation(api.reminders.create, hourly({ repeatMode: "count", repeatTimes: 3 }));

    await advance(t, 10 * MIN);
    for (let i = 0; i < 5; i++) await advance(t, HOUR);

    expect(sent).toHaveLength(3);
    const r = await getReminder(t, id);
    expect(r.firedCount).toBe(3);
    expect(r.active).toBe(false);
    expect(r.lastFiredAt).toBe(T0 + 130 * MIN);
  });

  test("forever keeps going", async () => {
    const t = newTest();
    const { sent } = stubExpoPush();
    const { as } = await setup(t);
    const id = await as.mutation(api.reminders.create, hourly());

    await advance(t, 10 * MIN);
    for (let i = 0; i < 9; i++) await advance(t, HOUR);

    expect(sent).toHaveLength(10);
    const r = await getReminder(t, id);
    expect(r.active).toBe(true);
    expect(r.nextFireAt).toBe(T0 + 10 * MIN + 10 * HOUR);
  });

  test("with no device, the schedule still advances and lastError is saved", async () => {
    const t = newTest();
    stubExpoPush();
    const { as } = await signedInUser(t, "a@example.com");
    const id = await as.mutation(api.reminders.create, hourly());

    await advance(t, 10 * MIN);

    const r = await getReminder(t, id);
    expect(r.lastError).toBe("noDevices");
    expect(r.firedCount).toBe(1);
    expect(r.nextFireAt).toBe(T0 + 70 * MIN);

    await as.mutation(api.pushTokens.register, { token: TOKEN, deviceName: "Pixel" });
    await advance(t, HOUR);
    expect((await getReminder(t, id)).lastError).toBeUndefined();
  });

  test("an Expo error is saved and the schedule advances", async () => {
    const t = newTest();
    stubExpoPush(() => "MessageRateExceeded");
    const { as } = await setup(t);
    const id = await as.mutation(api.reminders.create, hourly());

    await advance(t, 10 * MIN);

    const r = await getReminder(t, id);
    expect(r.lastError).toBe("failed: MessageRateExceeded");
    expect(r.nextFireAt).toBe(T0 + 70 * MIN);
  });

  test("a network failure is saved and the schedule advances", async () => {
    const t = newTest();
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("offline");
    }));
    const { as } = await setup(t);
    const id = await as.mutation(api.reminders.create, hourly());

    await advance(t, 10 * MIN);

    const r = await getReminder(t, id);
    expect(r.lastError).toContain("offline");
    expect(r.firedCount).toBe(1);
    expect(r.nextFireAt).toBe(T0 + 70 * MIN);
  });

  test("DeviceNotRegistered tokens are deleted", async () => {
    const t = newTest();
    stubExpoPush(() => "DeviceNotRegistered");
    const { as } = await setup(t);
    const id = await as.mutation(api.reminders.create, hourly());

    await advance(t, 10 * MIN);

    const tokens = await t.run((ctx) => ctx.db.query("pushTokens").collect());
    expect(tokens).toHaveLength(0);
    expect((await getReminder(t, id)).lastError).toBe("noDevices");
  });
});

describe("pause, resume, edit, delete", () => {
  test("pausing cancels the pending run", async () => {
    const t = newTest();
    const { sent } = stubExpoPush();
    const { as } = await setup(t);
    const id = await as.mutation(api.reminders.create, hourly());

    await as.mutation(api.reminders.setActive, { id, active: false });
    expect(await pendingJobs(t)).toHaveLength(0);
    await advance(t, 3 * HOUR);
    expect(sent).toHaveLength(0);
  });

  test("resuming skips fire times missed while paused", async () => {
    const t = newTest();
    const { sent } = stubExpoPush();
    const { as } = await setup(t);
    const id = await as.mutation(api.reminders.create, hourly({ repeatMode: "count", repeatTimes: 5 }));

    await advance(t, 10 * MIN); // fires once at 00:10
    await as.mutation(api.reminders.setActive, { id, active: false });
    await advance(t, 3 * HOUR + 20 * MIN); // now 03:30; 01:10, 02:10, 03:10 missed

    await as.mutation(api.reminders.setActive, { id, active: true });
    const r = await getReminder(t, id);
    expect(r.nextFireAt).toBe(T0 + 4 * HOUR + 10 * MIN);
    expect(r.firedCount).toBe(1);
    expect(sent).toHaveLength(1);

    // Missed times don't count: all 4 remaining fires still happen.
    for (let i = 0; i < 6; i++) await advance(t, HOUR);
    expect(sent).toHaveLength(5);
    expect((await getReminder(t, id)).active).toBe(false);
  });

  test("a finished reminder can't be resumed", async () => {
    const t = newTest();
    stubExpoPush();
    const { as } = await setup(t);
    const id = await as.mutation(api.reminders.create, hourly({ repeatMode: "once" }));
    await advance(t, 10 * MIN);
    await expect(as.mutation(api.reminders.setActive, { id, active: true })).rejects.toThrow(
      /reminderFinished/,
    );
  });

  test("editing cancels the old run and schedules the new time", async () => {
    const t = newTest();
    const { sent } = stubExpoPush();
    const { as } = await setup(t);
    const id = await as.mutation(api.reminders.create, hourly());

    await as.mutation(api.reminders.update, { id, ...hourly({ startAt: T0 + 30 * MIN }) });
    const jobs = await pendingJobs(t);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].scheduledTime).toBe(T0 + 30 * MIN);

    await advance(t, 10 * MIN);
    expect(sent).toHaveLength(0);
    await advance(t, 20 * MIN);
    expect(sent).toHaveLength(1);
  });

  test("editing a paused reminder keeps it paused with no run", async () => {
    const t = newTest();
    stubExpoPush();
    const { as } = await setup(t);
    const id = await as.mutation(api.reminders.create, hourly());
    await as.mutation(api.reminders.setActive, { id, active: false });
    await as.mutation(api.reminders.update, { id, ...hourly({ title: "Tea" }) });
    expect((await getReminder(t, id)).active).toBe(false);
    expect(await pendingJobs(t)).toHaveLength(0);
  });

  test("editing a count reminder below its fired count finishes it", async () => {
    const t = newTest();
    stubExpoPush();
    const { as } = await setup(t);
    const id = await as.mutation(api.reminders.create, hourly({ repeatMode: "count", repeatTimes: 5 }));
    await advance(t, 10 * MIN);
    await advance(t, HOUR);

    await as.mutation(api.reminders.update, { id, ...hourly({ repeatMode: "count", repeatTimes: 2 }) });
    const r = await getReminder(t, id);
    expect(r.active).toBe(false);
    expect(r.firedCount).toBe(2);
    expect(await pendingJobs(t)).toHaveLength(0);
  });

  test("a past start time on create jumps to the next future occurrence", async () => {
    const t = newTest();
    stubExpoPush();
    const { as } = await setup(t);
    const id = await as.mutation(api.reminders.create, hourly({ startAt: T0 - 150 * MIN }));
    expect((await getReminder(t, id)).nextFireAt).toBe(T0 + 30 * MIN);
  });

  test("deleting cancels the pending run and removes tag links", async () => {
    const t = newTest();
    const { sent } = stubExpoPush();
    const { as } = await setup(t);
    const tagId = await as.mutation(api.tags.create, { name: "Health" });
    const id = await as.mutation(api.reminders.create, hourly({ tagIds: [tagId] }));

    await as.mutation(api.reminders.remove, { id });
    expect(await pendingJobs(t)).toHaveLength(0);
    await advance(t, HOUR);
    expect(sent).toHaveLength(0);
    expect(await t.run((ctx) => ctx.db.query("reminderTags").collect())).toHaveLength(0);
  });
});

describe("validation", () => {
  test("rejects bad schedule input", async () => {
    const t = newTest();
    const { as } = await signedInUser(t, "a@example.com");
    await expect(as.mutation(api.reminders.create, hourly({ intervalCount: 0 }))).rejects.toThrow(/invalidIntervalCount/);
    await expect(as.mutation(api.reminders.create, hourly({ intervalCount: 1.5 }))).rejects.toThrow(/invalidIntervalCount/);
    await expect(as.mutation(api.reminders.create, hourly({ repeatMode: "count" }))).rejects.toThrow(/invalidRepeatTimes/);
    await expect(as.mutation(api.reminders.create, hourly({ title: "  " }))).rejects.toThrow(/titleRequired/);
    await expect(as.mutation(api.reminders.create, hourly({ message: "" }))).rejects.toThrow(/messageRequired/);
    await expect(as.mutation(api.reminders.create, hourly({ timeZone: "Mars/Base" }))).rejects.toThrow(/invalidTimeZone/);
  });

  test("requires sign-in", async () => {
    const t = newTest();
    await expect(t.query(api.reminders.list, {})).rejects.toThrow(/notAuthenticated/);
  });
});
