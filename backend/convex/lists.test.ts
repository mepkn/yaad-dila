import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { advance, newTest, signedInUser, stubExpoPush, type TestConvex } from "./test.helpers";

const MIN = 60_000;
const T0 = Date.UTC(2026, 0, 1, 0, 0);
const page = { numItems: 50, cursor: null };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function input(title: string, overrides: Record<string, unknown> = {}) {
  return {
    title,
    message: "ping",
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
  await user.as.mutation(api.pushTokens.register, {
    token: "ExponentPushToken[d]",
    deviceName: "Pixel",
  });
  return user;
}

describe("status lists", () => {
  test("each status is its own list; firing the last time moves a reminder to finished", async () => {
    const t = newTest();
    stubExpoPush();
    const { as } = await setup(t);
    const later = await as.mutation(api.reminders.create, input("later", { startAt: T0 + 50 * MIN }));
    const sooner = await as.mutation(api.reminders.create, input("sooner"));
    const paused = await as.mutation(api.reminders.create, input("paused"));
    const once = await as.mutation(api.reminders.create, input("once", { repeatMode: "once" }));
    await as.mutation(api.reminders.setActive, { id: paused, active: false });

    const ids = async (status: "active" | "paused" | "finished") =>
      (await as.query(api.reminders.list, { status, paginationOpts: page })).page.map((r) => r._id);
    // Soonest next fire first (ties keep creation order).
    expect(await ids("active")).toEqual([sooner, once, later]);
    expect(await ids("paused")).toEqual([paused]);
    expect(await ids("finished")).toEqual([]);

    await advance(t, 10 * MIN);
    expect(await ids("active")).toEqual([later, sooner]);
    expect(await ids("finished")).toEqual([once]);

    // Resuming a finished reminder is refused; editing in more fires restarts it.
    await expect(as.mutation(api.reminders.setActive, { id: once, active: true })).rejects.toThrow(
      /reminderFinished/,
    );
    await as.mutation(api.reminders.update, {
      id: once,
      ...input("once", { repeatMode: "forever", startAt: T0 + 30 * MIN }),
    });
    expect(await ids("finished")).toEqual([]);
    expect(await ids("active")).toContain(once);
  });
});

describe("tags and search", () => {
  test("a tag and search cover every status, and page through every match", async () => {
    const t = newTest();
    stubExpoPush();
    const { as } = await setup(t);
    const tag = await as.mutation(api.tags.create, { name: "Health" });
    const a = await as.mutation(api.reminders.create, input("Drink water", { tagIds: [tag] }));
    const p = await as.mutation(api.reminders.create, input("Water plants", { tagIds: [tag] }));
    const f = await as.mutation(
      api.reminders.create,
      input("Last water", { tagIds: [tag], repeatMode: "once" }),
    );
    await as.mutation(api.reminders.setActive, { id: p, active: false });
    await advance(t, 10 * MIN);
    expect((await as.query(api.reminders.get, { id: f }))?.status).toBe("finished");

    const byTag = await as.query(api.reminders.byTag, { tagId: tag, paginationOpts: page });
    expect(byTag.page.map((r) => r._id)).toEqual([f, p, a]);

    const found = await as.query(api.reminders.search, { query: "wat", paginationOpts: page });
    expect(found.page.map((r) => r._id).sort()).toEqual([a, p, f].sort());
    expect((await as.query(api.reminders.search, { query: " ", paginationOpts: page })).page).toEqual(
      [],
    );

    // Note text is searchable and follows edits.
    await as.mutation(api.reminders.update, { id: a, ...input("Drink water", { note: "kitchen" }) });
    const kitchen = await as.query(api.reminders.search, { query: "kitchen", paginationOpts: page });
    expect(kitchen.page.map((r) => r._id)).toEqual([a]);

    let cursor: string | null = null;
    let seen = 0;
    for (;;) {
      const r: { page: unknown[]; isDone: boolean; continueCursor: string } = await as.query(
        api.reminders.search,
        { query: "water", paginationOpts: { numItems: 2, cursor } },
      );
      seen += r.page.length;
      if (r.isDone) break;
      cursor = r.continueCursor;
    }
    expect(seen).toBe(3);
  });

  test("reminderCount follows tagging, untagging and delete", async () => {
    const t = newTest();
    const { as } = await setup(t);
    const a = await as.mutation(api.tags.create, { name: "a" });
    const b = await as.mutation(api.tags.create, { name: "b" });
    const counts = async () =>
      Object.fromEntries((await as.query(api.tags.list, {})).map((x) => [x.name, x.reminderCount]));

    const r1 = await as.mutation(api.reminders.create, input("one", { tagIds: [a, b] }));
    await as.mutation(api.reminders.create, input("two", { tagIds: [a] }));
    expect(await counts()).toEqual({ a: 2, b: 1 });
    await as.mutation(api.reminders.update, { id: r1, ...input("one", { tagIds: [b] }) });
    expect(await counts()).toEqual({ a: 1, b: 1 });
    await as.mutation(api.reminders.remove, { id: r1 });
    expect(await counts()).toEqual({ a: 1, b: 0 });
  });

  test("deleting a tag on more reminders than one batch cleans up every reminder", async () => {
    const t = newTest();
    const { as } = await setup(t);
    const big = await as.mutation(api.tags.create, { name: "big" });
    const keep = await as.mutation(api.tags.create, { name: "keep" });
    for (let i = 0; i < 230; i++) {
      await as.mutation(api.reminders.create, input(`r${i}`, { tagIds: [big, keep] }));
    }
    await as.mutation(api.tags.remove, { id: big });
    await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0));

    const rows = await t.run((ctx) => ctx.db.query("reminderTags").collect());
    expect(rows).toHaveLength(230);
    expect(rows.every((r) => r.tagId === keep)).toBe(true);
    const reminders = await t.run((ctx) => ctx.db.query("reminders").collect());
    expect(reminders.every((r) => r.tagIds.length === 1 && r.tagIds[0] === keep)).toBe(true);
    expect(await as.query(api.tags.list, {})).toEqual([
      expect.objectContaining({ name: "keep", reminderCount: 230 }),
    ]);
  });
});
