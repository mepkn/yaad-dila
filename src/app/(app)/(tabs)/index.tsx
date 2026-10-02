import { useQuery } from "convex/react";
import { router } from "expo-router";
import { Mic, Plus, Search } from "lucide-react-native";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, FlatList, View } from "react-native";
import { api } from "@convex/_generated/api";
import { reminderStatus, type ReminderStatus } from "@convex/lib/schedule";
import { CmpButton } from "@/components/cmp/cmp-button";
import { CmpInput } from "@/components/cmp/cmp-field";
import { CmpIcon } from "@/components/cmp/cmp-icon";
import { CmpSegmented } from "@/components/cmp/cmp-segmented";
import { CmpText } from "@/components/cmp/cmp-text";
import { ReminderCard } from "@/components/reminder-card";

type Filter = "all" | ReminderStatus;

export default function RemindersScreen() {
  const { t } = useTranslation();
  const reminders = useQuery(api.reminders.list);
  const tags = useQuery(api.tags.list);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const tagNameById = useMemo(
    () => new Map((tags ?? []).map((tag) => [tag._id as string, tag.name])),
    [tags],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (reminders ?? [])
      .map((r) => ({
        reminder: r,
        status: reminderStatus(r),
        tagNames: r.tagIds.map((id) => tagNameById.get(id)).filter((n): n is string => !!n),
      }))
      .filter((row) => filter === "all" || row.status === filter)
      .filter((row) => {
        if (!q) return true;
        const { title, message, note } = row.reminder;
        return [title, message, note ?? "", ...row.tagNames].some((s) =>
          s.toLowerCase().includes(q),
        );
      })
      // Active first (soonest next), then paused, then finished.
      .sort((a, b) => {
        const rank = { active: 0, paused: 1, finished: 2 };
        return (
          rank[a.status] - rank[b.status] || a.reminder.nextFireAt - b.reminder.nextFireAt
        );
      });
  }, [reminders, search, filter, tagNameById]);

  return (
    <View className="bg-background flex-1">
      <View className="gap-3 px-4 pb-2 pt-3">
        <View className="relative justify-center">
          <View className="absolute left-3 z-10">
            <CmpIcon as={Search} size={16} className="text-muted-foreground" />
          </View>
          <CmpInput
            className="pl-9"
            placeholder={t("reminders.searchPlaceholder")}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
        </View>
        <CmpSegmented
          value={filter}
          onChange={setFilter}
          options={(["all", "active", "paused", "finished"] as const).map((value) => ({
            value,
            label: t(`reminders.filter.${value}`),
          }))}
        />
      </View>

      {reminders === undefined ? (
        <ActivityIndicator className="mt-10" />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(row) => row.reminder._id}
          contentContainerClassName="gap-3 px-4 pb-32 pt-2"
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <ReminderCard reminder={item.reminder} tagNames={item.tagNames} />
          )}
          ListEmptyComponent={
            <CmpText variant="muted" className="mt-10 text-center">
              {reminders.length === 0 ? t("reminders.empty") : t("reminders.emptyFiltered")}
            </CmpText>
          }
        />
      )}

      <View className="absolute bottom-6 right-5 items-center gap-3">
        <CmpButton
          size="icon"
          variant="secondary"
          className="h-12 w-12 rounded-full shadow-md"
          icon={Mic}
          label={t("reminders.addByVoice")}
          onPress={() => router.push("/voice")}
        />
        <CmpButton
          size="icon"
          className="h-16 w-16 rounded-full shadow-lg"
          icon={Plus}
          label={t("reminders.add")}
          onPress={() => router.push("/reminder/new")}
        />
      </View>
    </View>
  );
}
