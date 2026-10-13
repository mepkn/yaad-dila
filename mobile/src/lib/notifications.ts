import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export const CHANNEL_ID = "reminders";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Reminders",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  });
}

export type PermissionState = "granted" | "denied" | "undetermined";

export async function getPermission(): Promise<PermissionState> {
  const { status } = await Notifications.getPermissionsAsync();
  return status as PermissionState;
}

// The channel must exist before asking on Android 13+, or no prompt is shown.
export async function requestPermission(): Promise<PermissionState> {
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.status === "granted" || !current.canAskAgain) return current.status as PermissionState;
  const { status } = await Notifications.requestPermissionsAsync();
  return status as PermissionState;
}

export type PushTokenResult =
  | { kind: "token"; token: string }
  | { kind: "unavailable" } // simulator / Expo Go / web
  | { kind: "notConfigured" } // no EAS projectId
  | { kind: "denied" };

export function easProjectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

export async function getPushToken(): Promise<PushTokenResult> {
  if (!Device.isDevice || Platform.OS === "web") return { kind: "unavailable" };
  const projectId = easProjectId();
  if (!projectId) return { kind: "notConfigured" };
  if ((await getPermission()) !== "granted") return { kind: "denied" };
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return { kind: "token", token: data };
  } catch {
    return { kind: "unavailable" };
  }
}

export function deviceName(): string {
  return Device.deviceName ?? [Device.manufacturer, Device.modelName].filter(Boolean).join(" ");
}

export function reminderIdFrom(response: Notifications.NotificationResponse): string | undefined {
  const id = response.notification.request.content.data?.reminderId;
  return typeof id === "string" ? id : undefined;
}
