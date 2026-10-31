/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import { systemPrompt, toDraft } from "./lib/voice";
import { newTest, signedInUser } from "./test.helpers";

const NOW = Date.UTC(2026, 9, 31, 9, 0); // Sat 31 Oct 2026, 14:30 in Kolkata
const ZONE = "Asia/Kolkata";

const answer = {
  title: "Drink water",
  message: "Time to drink water",
  note: "",
  intervalCount: 2,
  intervalUnit: "hours",
  repeatMode: "count",
  repeatTimes: 5,
  startLocal: "2026-11-01T09:00",
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.stubEnv("KUNJI_URL", "https://kunji.test/");
  vi.stubEnv("KUNJI_SECRET", "kjs_secret");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function stubGateway(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("lib/voice", () => {
  it("tells the model the local time", () => {
    expect(systemPrompt(NOW, ZONE)).toContain("2026-10-31T14:30 (Asia/Kolkata, Saturday)");
  });

  it("turns the answer into form fields in the user's zone", () => {
    expect(toDraft(answer, ZONE)).toEqual({
      title: "Drink water",
      message: "Time to drink water",
      note: undefined,
      intervalCount: 2,
      intervalUnit: "hours",
      repeatMode: "count",
      repeatTimes: 5,
      startAt: Date.UTC(2026, 10, 1, 3, 30),
    });
    expect(toDraft({ ...answer, repeatMode: "forever" }, ZONE)?.repeatTimes).toBeUndefined();
    expect(toDraft({ ...answer, intervalUnit: "years" }, ZONE)).toBeNull();
    expect(toDraft({ ...answer, title: " " }, ZONE)).toBeNull();
    expect(toDraft("nope", ZONE)).toBeNull();
  });
});

describe("voice.parse", () => {
  it("asks kunji's gateway as the signed-in user and returns the draft", async () => {
    const t = newTest();
    const { as } = await signedInUser(t, "alice@example.com");
    const fetchMock = stubGateway(200, { text: "", json: answer, provider: "gemini", model: "x", usage: { inputTokens: 1, outputTokens: 1 } });
    const draft = await as.action(api.voice.parse, { text: "remind me to drink water", timeZone: ZONE });
    expect(draft).toMatchObject({ title: "Drink water", startAt: Date.UTC(2026, 10, 1, 3, 30) });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://kunji.test/ai/v1/generate");
    expect(init.headers).toMatchObject({ Authorization: "Bearer kjs_secret" });
    expect(JSON.parse(String(init.body))).toMatchObject({ userEmail: "alice@example.com", model: "fast", json: { type: "object" } });
  });

  it("reads JSON from text when the provider gives no json field", async () => {
    const t = newTest();
    const { as } = await signedInUser(t, "alice@example.com");
    stubGateway(200, { text: JSON.stringify(answer), provider: "groq", model: "x", usage: { inputTokens: 1, outputTokens: 1 } });
    expect((await as.action(api.voice.parse, { text: "drink water", timeZone: ZONE })).title).toBe("Drink water");
  });

  it.each([
    [403, "no_key", "noAiKey"],
    [401, "key_refused", "aiKeyRefused"],
    [429, "rate_limited", "aiRateLimited"],
    [401, "unauthorized", "notConnected"],
    [502, "provider_error", "aiUnavailable"],
  ])("maps kunji's %s %s to %s", async (status, code, expected) => {
    const t = newTest();
    const { as } = await signedInUser(t, "alice@example.com");
    stubGateway(status, { error: { code, message: "x" } });
    await expect(as.action(api.voice.parse, { text: "drink water", timeZone: ZONE })).rejects.toThrow(expected);
  });

  it("refuses an unusable answer, short text and strangers", async () => {
    const t = newTest();
    const { as } = await signedInUser(t, "alice@example.com");
    stubGateway(200, { text: "sorry", provider: "x", model: "x", usage: { inputTokens: 1, outputTokens: 1 } });
    await expect(as.action(api.voice.parse, { text: "drink water", timeZone: ZONE })).rejects.toThrow("unparseable");
    await expect(as.action(api.voice.parse, { text: "hi", timeZone: ZONE })).rejects.toThrow("unparseable");
    await expect(t.action(api.voice.parse, { text: "drink water", timeZone: ZONE })).rejects.toThrow("notAuthenticated");
  });
});
