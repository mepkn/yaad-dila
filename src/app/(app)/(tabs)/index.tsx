import { usePaginatedQuery } from "convex/react";
import { router } from "expo-router";
import { Mic, Plus } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { api } from "@convex/_generated/api";
import type { ReminderStatus } from "@convex/lib/schedule";
import { CmpButton } from "@/components/cmp/cmp-button";
import { CmpSegmented } from "@/components/cmp/cmp-segmented";
import { PAGE_SIZE, ReminderList } from "@/components/reminder-list";
import { cn } from "@/lib/utils";

const EMPTY: Record<ReminderStatus, string> = {
  active: "reminders.empty",
  paused: "reminders.emptyPaused",
  finished: "reminders.emptyFinished",
};

export default function RemindersScreen() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<ReminderStatus>("active");
  const [scrolled, setScrolled] = useState(false);
  // Each status is its own server-side, paginated list.
  const list = usePaginatedQuery(api.reminders.list, { status }, { initialNumItems: PAGE_SIZE });

  return (
    <View className="bg-background flex-1">
      {/* The border shows once the list scrolls under the filter. */}
      <View
        className={cn(
          "border-b px-4 pb-3 pt-3",
          scrolled ? "border-border" : "border-transparent",
        )}>
        <CmpSegmented
          value={status}
          onChange={setStatus}
          options={(["active", "paused", "finished"] as const).map((value) => ({
            value,
            label: t(`reminders.filter.${value}`),
          }))}
        />
      </View>

      <ReminderList
        results={list.results}
        status={list.status}
        loadMore={list.loadMore}
        empty={t(EMPTY[status])}
        onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > 0)}
      />

      <View className="absolute bottom-6 right-6 items-center gap-3">
        <CmpButton
          size="icon"
          variant="secondary"
          className="size-12 rounded-full shadow-md"
          icon={Mic}
          label={t("reminders.addByVoice")}
          onPress={() => router.push("/voice")}
        />
        <CmpButton
          size="icon"
          className="size-14 rounded-full shadow-lg shadow-black/20"
          icon={Plus}
          label={t("reminders.add")}
          onPress={() => router.push("/reminder/new")}
        />
      </View>
    </View>
  );
}
