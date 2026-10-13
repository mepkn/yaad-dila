import { useMutation } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "@convex/_generated/api";
import { ReminderForm, type ReminderFormValues } from "@/components/reminder-form";
import { decodeDraft } from "@/lib/draft";

// The next whole 5 minutes from now.
function defaultStart(): number {
  const step = 5 * 60_000;
  return Math.ceil((Date.now() + 60_000) / step) * step;
}

export default function NewReminderScreen() {
  const { t } = useTranslation();
  const { draft } = useLocalSearchParams<{ draft?: string }>();
  const create = useMutation(api.reminders.create);
  const [initial] = useState<ReminderFormValues>(() => ({
    title: "",
    message: "",
    intervalCount: 1,
    intervalUnit: "hours",
    repeatMode: "forever",
    startAt: defaultStart(),
    ...decodeDraft(draft),
    tagIds: [],
  }));

  return (
    <ReminderForm
      initial={initial}
      submitLabel={t("common.save")}
      onSubmit={async (input) => {
        await create(input);
        router.dismissTo("/");
      }}
    />
  );
}
