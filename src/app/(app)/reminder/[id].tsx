import { useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { AlertTriangle, Pause, Play, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, View } from "react-native";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { reminderStatus, totalFires } from "@convex/lib/schedule";
import { CmpBadge } from "@/components/cmp/cmp-badge";
import { CmpButton } from "@/components/cmp/cmp-button";
import { CmpCard, CmpCardContent } from "@/components/cmp/cmp-card";
import { CmpConfirmDialog } from "@/components/cmp/cmp-confirm-dialog";
import { CmpIcon } from "@/components/cmp/cmp-icon";
import { CmpText } from "@/components/cmp/cmp-text";
import { ReminderForm } from "@/components/reminder-form";
import { errorMessage, lastErrorMessage } from "@/lib/errors";
import { formatDateTime, scheduleSummary } from "@/lib/format";

export default function EditReminderScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const reminderId = id as Id<"reminders">;
  const reminder = useQuery(api.reminders.get, { id: reminderId });
  const update = useMutation(api.reminders.update);
  const setActive = useMutation(api.reminders.setActive);
  const remove = useMutation(api.reminders.remove);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState<string>();
  const [busy, setBusy] = useState(false);

  if (reminder === undefined) return <ActivityIndicator className="mt-10" />;
  if (reminder === null) {
    return (
      <View className="bg-background flex-1 items-center justify-center p-6">
        <CmpText variant="muted" className="text-center">
          {t("reminders.notFound")}
        </CmpText>
      </View>
    );
  }

  const status = reminderStatus(reminder);
  const total = totalFires(reminder);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setActionError(undefined);
    try {
      await action();
    } catch (e) {
      setActionError(errorMessage(t, e));
    } finally {
      setBusy(false);
    }
  }

  const summary = (
    <CmpCard>
      <CmpCardContent className="gap-2">
        <View className="flex-row items-center justify-between">
          <CmpBadge
            variant={status === "active" ? "default" : "secondary"}
            label={t(`reminders.status.${status}`)}
          />
          {status !== "finished" && (
            <CmpButton
              size="sm"
              variant="outline"
              icon={status === "active" ? Pause : Play}
              label={t(status === "active" ? "reminders.pause" : "reminders.resume")}
              loading={busy}
              onPress={() => run(() => setActive({ id: reminderId, active: status !== "active" }))}
            />
          )}
        </View>
        <CmpText variant="muted">{scheduleSummary(t, reminder, i18n.language)}</CmpText>
        {status === "active" && (
          <CmpText>
            {t("reminders.next", { time: formatDateTime(reminder.nextFireAt, i18n.language) })}
          </CmpText>
        )}
        <CmpText variant="muted">
          {Number.isFinite(total)
            ? t("reminders.firedOf", { n: reminder.firedCount, total })
            : t("reminders.fired", { n: reminder.firedCount })}
          {reminder.lastFiredAt !== undefined &&
            ` · ${t("reminders.lastFired", { time: formatDateTime(reminder.lastFiredAt, i18n.language) })}`}
        </CmpText>
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
  );

  return (
    <>
      <View className="bg-background px-4 pt-4">{summary}</View>
      <ReminderForm
        key={reminder._id}
        initial={reminder}
        submitLabel={t("common.save")}
        onSubmit={async (input) => {
          await update({ id: reminderId, ...input });
          router.back();
        }}
        footer={
          <CmpButton
            variant="ghost"
            icon={Trash2}
            className="mt-2"
            label={t("common.delete")}
            onPress={() => setConfirmDelete(true)}
          />
        }
      />
      <CmpConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("reminders.deleteTitle")}
        description={t("reminders.deleteDescription")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        onConfirm={() =>
          run(async () => {
            await remove({ id: reminderId });
            router.back();
          })
        }
      />
    </>
  );
}
