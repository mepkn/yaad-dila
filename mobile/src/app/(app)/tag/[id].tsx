import { usePaginatedQuery, useQuery } from "convex/react";
import { Stack, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { api } from "@convex/_generated/api";
import { CmpText } from "@/components/cmp/cmp-text";
import { PAGE_SIZE, ReminderList } from "@/components/reminder-list";

// Every reminder with one tag, in any status.
export default function TagScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tags = useQuery(api.tags.list);
  const tag = tags?.find((x) => x._id === id);
  const reminders = usePaginatedQuery(
    api.reminders.byTag,
    tag ? { tagId: tag._id } : "skip",
    { initialNumItems: PAGE_SIZE },
  );

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: tag?.name ?? t("tabs.tags") }} />
      {tags !== undefined && !tag ? (
        <CmpText variant="muted" className="mt-10 px-4 text-center">
          {t("tags.notFound")}
        </CmpText>
      ) : (
        <ReminderList
          results={reminders.results}
          status={tag ? reminders.status : "LoadingFirstPage"}
          loadMore={reminders.loadMore}
          empty={t("tags.emptyTag")}
          contentContainerClassName="gap-3 px-4 pb-10 pt-3"
        />
      )}
    </View>
  );
}
