import { useMutation } from "convex/react";
import { router } from "expo-router";
import { AlertTriangle, Pause, Play } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { reminderStatus, totalFires } from "@convex/lib/schedule";
import { CmpBadge } from "@/components/cmp/cmp-badge";
import { CmpButton } from "@/components/cmp/cmp-button";
import { CmpCard, CmpCardContent } from "@/components/cmp/cmp-card";
import { CmpIcon } from "@/components/cmp/cmp-icon";
import { CmpText } from "@/components/cmp/cmp-text";
import { errorMessage, lastErrorMessage } from "@/lib/errors";
import { formatDateTime, scheduleSummary } from "@/lib/format";

type Props = {
  reminder: Doc<"reminders">;
  tagNames: string[];
};

export function ReminderCard({ reminder, tagNames }: Props) {
  const { t, i18n } = useTranslation();
  const setActive = useMutation(api.reminders.setActive);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string>();
  const status = reminderStatus(reminder);
  const total = totalFires(reminder);

  async function toggle() {
    setBusy(true);
    setActionError(undefined);
    try {
      await setActive({ id: reminder._id, active: status !== "active" });
    } catch (e) {
      setActionError(errorMessage(t, e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: "/reminder/[id]", params: { id: reminder._id } })}>
      <CmpCard className={status === "finished" ? "opacity-70" : undefined}>
        <CmpCardContent className="gap-2">
          <View className="flex-row items-start gap-3">
            <View className="flex-1 gap-1">
              <CmpText className="text-base font-semibold" numberOfLines={1}>
                {reminder.title}
              </CmpText>
              <CmpText variant="muted" numberOfLines={1}>
                {scheduleSummary(t, reminder, i18n.language)}
              </CmpText>
            </View>
            {status === "finished" ? (
              <CmpBadge variant="secondary" label={t("reminders.status.finished")} />
            ) : (
              <CmpButton
                size="icon"
                variant={status === "active" ? "secondary" : "default"}
                icon={status === "active" ? Pause : Play}
                label={t(status === "active" ? "reminders.pause" : "reminders.resume")}
                loading={busy}
                onPress={toggle}
              />
            )}
          </View>

          <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
            {status === "active" && (
              <CmpText className="text-sm">
                {t("reminders.next", { time: formatDateTime(reminder.nextFireAt, i18n.language) })}
              </CmpText>
            )}
            {status === "paused" && (
              <CmpBadge variant="outline" label={t("reminders.status.paused")} />
            )}
            <CmpText variant="muted">
              {Number.isFinite(total)
                ? t("reminders.firedOf", { n: reminder.firedCount, total })
                : t("reminders.fired", { n: reminder.firedCount })}
            </CmpText>
          </View>

          {tagNames.length > 0 && (
            <View className="flex-row flex-wrap gap-1.5">
              {tagNames.map((name) => (
                <CmpBadge key={name} variant="outline" label={name} />
              ))}
            </View>
          )}

          {(reminder.lastError || actionError) && (
            <View className="bg-destructive/10 flex-row items-start gap-2 rounded-md p-2">
              <CmpIcon as={AlertTriangle} size={16} className="text-destructive mt-0.5" />
              <CmpText className="text-destructive flex-1 text-sm">
                {actionError ?? lastErrorMessage(t, reminder.lastError!)}
              </CmpText>
            </View>
          )}
        </CmpCardContent>
      </CmpCard>
    </Pressable>
  );
}
