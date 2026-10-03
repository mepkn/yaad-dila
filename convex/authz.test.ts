import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { newTest, signedInUser, type TestConvex } from "./test.helpers";

const T0 = Date.UTC(2026, 0, 1);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => vi.useRealTimers());

function input(tagIds: Id<"tags">[] = []) {
  return {
    title: "Alice's reminder",
    message: "secret",
    tagIds,
    intervalCount: 1,
    intervalUnit: "days" as const,
    repeatMode: "forever" as const,
    startAt: T0 + 60_000,
    timeZone: "UTC",
  };
}

async function twoUsers(t: TestConvex) {
  const alice = await signedInUser(t, "alice@example.com");
  const bob = await signedInUser(t, "bob@example.com");
  const tagId = await alice.as.mutation(api.tags.create, { name: "Private" });
  const reminderId = await alice.as.mutation(api.reminders.create, input([tagId]));
  return { alice, bob, tagId, reminderId };
}

describe("reminders", () => {
  test("another user can't read them", async () => {
    const t = newTest();
    const { bob, reminderId } = await twoUsers(t);
    expect(await bob.as.query(api.reminders.get, { id: reminderId })).toBeNull();
    expect(await bob.as.query(api.reminders.list, {})).toEqual([]);
  });

  test("another user can't modify or delete them", async () => {
    const t = newTest();
    const { alice, bob, reminderId } = await twoUsers(t);
    await expect(
      bob.as.mutation(api.reminders.update, { id: reminderId, ...input(), title: "pwned" }),
    ).rejects.toThrow(/reminderNotFound/);
    await expect(
      bob.as.mutation(api.reminders.setActive, { id: reminderId, active: false }),
    ).rejects.toThrow(/reminderNotFound/);
    await expect(bob.as.mutation(api.reminders.remove, { id: reminderId })).rejects.toThrow(
      /reminderNotFound/,
    );

    const r = await alice.as.query(api.reminders.get, { id: reminderId });
    expect(r).toMatchObject({ title: "Alice's reminder", active: true });
  });

  test("another user can't attach someone else's tag", async () => {
    const t = newTest();
    const { bob, tagId } = await twoUsers(t);
    await expect(bob.as.mutation(api.reminders.create, input([tagId]))).rejects.toThrow(
      /tagNotFound/,
    );
  });
});

describe("tags", () => {
  test("another user can't see, rename or delete them", async () => {
    const t = newTest();
    const { alice, bob, tagId } = await twoUsers(t);
    expect(await bob.as.query(api.tags.list, {})).toEqual([]);
    await expect(bob.as.mutation(api.tags.rename, { id: tagId, name: "x" })).rejects.toThrow(
      /tagNotFound/,
    );
    await expect(bob.as.mutation(api.tags.remove, { id: tagId })).rejects.toThrow(/tagNotFound/);
    expect(await alice.as.query(api.tags.list, {})).toEqual([
      { _id: tagId, name: "Private", reminderCount: 1 },
    ]);
  });

  test("names are unique per user, not globally", async () => {
    const t = newTest();
    const { alice, bob } = await twoUsers(t);
    await expect(alice.as.mutation(api.tags.create, { name: " Private " })).rejects.toThrow(
      /tagNameTaken/,
    );
    await expect(alice.as.mutation(api.tags.create, { name: "private" })).rejects.toThrow(
      /tagNameTaken/,
    );
    await expect(bob.as.mutation(api.tags.create, { name: "Private" })).resolves.toBeTruthy();
  });

  test("renaming only changes case of the same tag is allowed", async () => {
    const t = newTest();
    const { alice, tagId } = await twoUsers(t);
    await alice.as.mutation(api.tags.rename, { id: tagId, name: "PRIVATE" });
    expect((await alice.as.query(api.tags.list, {}))[0].name).toBe("PRIVATE");
  });

  test("deleting a tag removes it from the owner's reminders", async () => {
    const t = newTest();
    const { alice, tagId, reminderId } = await twoUsers(t);
    await alice.as.mutation(api.tags.remove, { id: tagId });
    const r = await alice.as.query(api.reminders.get, { id: reminderId });
    expect(r?.tagIds).toEqual([]);
  });
});

describe("push tokens", () => {
  test("a user can't unregister another user's token", async () => {
    const t = newTest();
    const { alice, bob } = await twoUsers(t);
    const token = "ExponentPushToken[alice-phone]";
    await alice.as.mutation(api.pushTokens.register, { token, deviceName: "Pixel" });
    await bob.as.mutation(api.pushTokens.unregister, { token });
    const rows = await t.run((ctx) => ctx.db.query("pushTokens").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(alice.userId);
  });

  test("signing in on a device moves its token to the new user", async () => {
    const t = newTest();
    const { alice, bob } = await twoUsers(t);
    const token = "ExponentPushToken[shared-phone]";
    await alice.as.mutation(api.pushTokens.register, { token, deviceName: "Pixel" });
    await bob.as.mutation(api.pushTokens.register, { token, deviceName: "Pixel" });
    const rows = await t.run((ctx) => ctx.db.query("pushTokens").collect());
    expect(rows.map((r) => r.userId)).toEqual([bob.userId]);
  });
});

describe("allowlist", () => {
  test("a signed-in user whose email isn't allowed is refused", async () => {
    const t = newTest();
    const mallory = await signedInUser(t, "mallory@example.com");
    await expect(mallory.as.query(api.reminders.list, {})).rejects.toThrow("notAllowed");
    await expect(mallory.as.mutation(api.tags.create, { name: "x" })).rejects.toThrow("notAllowed");
  });

  test("removing an email cuts off an existing session", async () => {
    const t = newTest();
    const alice = await signedInUser(t, "alice@example.com");
    expect(await alice.as.query(api.reminders.list, {})).toEqual([]);
    vi.stubEnv("ALLOWED_EMAILS", "bob@example.com");
    await expect(alice.as.query(api.reminders.list, {})).rejects.toThrow("notAllowed");
  });
});
