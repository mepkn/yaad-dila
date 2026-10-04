import { useQuery } from "convex/react";
import { router } from "expo-router";
import { Mic, Plus, Search } from "lucide-react-native";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, FlatList, ScrollView, View } from "react-native";
import { api } from "@convex/_generated/api";
import { reminderStatus, type ReminderStatus } from "@convex/lib/schedule";
import { CmpButton } from "@/components/cmp/cmp-button";
import { CmpChip } from "@/components/cmp/cmp-chip";
import { CmpInput } from "@/components/cmp/cmp-field";
import { CmpIcon } from "@/components/cmp/cmp-icon";
import { CmpSegmented } from "@/components/cmp/cmp-segmented";
import { CmpText } from "@/components/cmp/cmp-text";
import { ReminderCard } from "@/components/reminder-card";
import { cn } from "@/lib/utils";

type Filter = "all" | ReminderStatus;

export default function RemindersScreen() {
  const { t } = useTranslation();
  const reminders = useQuery(api.reminders.list);
  const tags = useQuery(api.tags.list);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [tagId, setTagId] = useState<string>();
  const [scrolled, setScrolled] = useState(false);

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
      .filter((row) => !tagId || row.reminder.tagIds.some((id) => id === tagId))
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
  }, [reminders, search, filter, tagId, tagNameById]);

  return (
    <View className="bg-background flex-1">
      {/* The border shows once the list scrolls under the filters. */}
      <View
        className={cn(
          "gap-3 border-b px-4 pb-3 pt-3",
          scrolled ? "border-border" : "border-transparent",
        )}>
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
        {tags && tags.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2"
            keyboardShouldPersistTaps="handled">
            <CmpChip
              label={t("reminders.filter.all")}
              selected={!tagId}
              onPress={() => setTagId(undefined)}
            />
            {tags.map((tag) => (
              <CmpChip
                key={tag._id}
                label={tag.name}
                selected={tag._id === tagId}
                onPress={() => setTagId(tag._id === tagId ? undefined : tag._id)}
              />
            ))}
          </ScrollView>
        )}
      </View>

      {reminders === undefined ? (
        <ActivityIndicator className="mt-10" />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(row) => row.reminder._id}
          contentContainerClassName="gap-3 px-4 pb-32 pt-1"
          keyboardShouldPersistTaps="handled"
          onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > 0)}
          scrollEventThrottle={32}
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
