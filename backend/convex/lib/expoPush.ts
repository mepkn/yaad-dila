import { env } from "../_generated/server";

export const ANDROID_CHANNEL_ID = "reminders";
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const MAX_PER_REQUEST = 100;

export type PushMessage = {
  title: string;
  body: string;
  data: Record<string, string>;
};

export type PushResult = {
  delivered: number;
  // Tokens Expo says are no longer registered; the caller deletes them.
  unregisteredTokens: string[];
  // First error seen, or undefined if every send was accepted.
  error?: string;
};

type Ticket =
  | { status: "ok"; id: string }
  | { status: "error"; message: string; details?: { error?: string } };

// Sends one message to every token through the Expo push API.
export async function sendPush(
  tokens: string[],
  message: PushMessage,
): Promise<PushResult> {
  const result: PushResult = { delivered: 0, unregisteredTokens: [] };
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (env.EXPO_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${env.EXPO_ACCESS_TOKEN}`;
  }

  for (let i = 0; i < tokens.length; i += MAX_PER_REQUEST) {
    const batch = tokens.slice(i, i + MAX_PER_REQUEST);
    let tickets: Ticket[];
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(
          batch.map((to) => ({
            to,
            title: message.title,
            body: message.body,
            data: message.data,
            channelId: ANDROID_CHANNEL_ID,
            priority: "high",
            sound: "default",
          })),
        ),
      });
      const json = (await response.json()) as {
        data?: Ticket[];
        errors?: { message?: string }[];
      };
      if (!response.ok || !Array.isArray(json.data)) {
        result.error ??= `Expo push HTTP ${response.status}: ${
          json.errors?.[0]?.message ?? "unexpected response"
        }`;
        continue;
      }
      tickets = json.data;
    } catch (e) {
      result.error ??= `Expo push request failed: ${
        e instanceof Error ? e.message : String(e)
      }`;
      continue;
    }

    tickets.forEach((ticket, j) => {
      if (ticket.status === "ok") {
        result.delivered += 1;
      } else if (ticket.details?.error === "DeviceNotRegistered") {
        result.unregisteredTokens.push(batch[j]);
      } else {
        result.error ??= ticket.message;
      }
    });
  }
  return result;
}
