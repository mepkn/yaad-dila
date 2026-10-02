import * as Notifications from "expo-notifications";
import { Stack, router } from "expo-router";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { reminderIdFrom } from "@/lib/notifications";
import { PushProvider } from "@/lib/push";

// Opens the reminder a tapped notification belongs to, including the tap that
// launched the app.
function useNotificationDeepLinks() {
  const lastResponse = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!lastResponse) return;
    const key = lastResponse.notification.request.identifier;
    if (handled.current === key) return;
    handled.current = key;
    const reminderId = reminderIdFrom(lastResponse);
    if (reminderId) router.push({ pathname: "/reminder/[id]", params: { id: reminderId } });
    Notifications.clearLastNotificationResponse();
  }, [lastResponse]);
}

export default function AppLayout() {
  const { t } = useTranslation();
  useNotificationDeepLinks();
  return (
    <PushProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="reminder/new" options={{ title: t("form.newTitle") }} />
        <Stack.Screen name="reminder/[id]" options={{ title: t("form.editTitle") }} />
        <Stack.Screen name="voice" options={{ title: t("voice.title"), presentation: "modal" }} />
      </Stack>
    </PushProvider>
  );
}
