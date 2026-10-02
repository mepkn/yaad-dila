/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { vi } from "vitest";
import schema from "./schema";

export const modules = import.meta.glob("./**/*.ts");

export function newTest() {
  return convexTest(schema, modules);
}

export type TestConvex = ReturnType<typeof newTest>;

export async function signedInUser(t: TestConvex, email: string) {
  const userId = await t.run((ctx) => ctx.db.insert("users", { email }));
  return { userId, as: t.withIdentity({ subject: `${userId}|session-${email}` }) };
}

type PushOutcome = "ok" | "DeviceNotRegistered" | "MessageRateExceeded";

// Stubs the Expo push API. outcome(token) picks each ticket's result.
export function stubExpoPush(outcome: (token: string) => PushOutcome = () => "ok") {
  const sent: { to: string; title: string; body: string; data: unknown; channelId: string }[] = [];
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const messages = JSON.parse(String(init?.body)) as typeof sent;
    sent.push(...messages);
    const data = messages.map((m) => {
      const result = outcome(m.to);
      return result === "ok"
        ? { status: "ok", id: `ticket-${m.to}` }
        : { status: "error", message: `failed: ${result}`, details: { error: result } };
    });
    return new Response(JSON.stringify({ data }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { sent, fetchMock };
}

// Moves the fake clock forward and runs whatever came due.
export async function advance(t: TestConvex, ms: number) {
  vi.advanceTimersByTime(ms);
  await t.finishInProgressScheduledFunctions();
}
