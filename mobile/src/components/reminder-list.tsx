import { useQuery } from "convex/react";
import { useMemo } from "react";
import { ActivityIndicator, FlatList, type FlatListProps } from "react-native";
import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { CmpText } from "@/components/cmp/cmp-text";
import { ReminderCard } from "@/components/reminder-card";

export const PAGE_SIZE = 30;

type Props = {
  // From usePaginatedQuery.
  results: Doc<"reminders">[];
  status: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";
  loadMore: (n: number) => void;
  empty: string;
} & Pick<FlatListProps<Doc<"reminders">>, "onScroll" | "contentContainerClassName">;

// A paginated list of reminder cards that loads the next page on scroll.
export function ReminderList({ results, status, loadMore, empty, ...rest }: Props) {
  const tags = useQuery(api.tags.list);
  const tagNameById = useMemo(
    () => new Map((tags ?? []).map((tag) => [tag._id as string, tag.name])),
    [tags],
  );

  if (status === "LoadingFirstPage") return <ActivityIndicator className="mt-10" />;
  return (
    <FlatList
      data={results}
      keyExtractor={(r) => r._id}
      contentContainerClassName="gap-3 px-4 pb-32 pt-1"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      scrollEventThrottle={32}
      {...rest}
      renderItem={({ item }) => (
        <ReminderCard
          reminder={item}
          tagNames={item.tagIds.map((id) => tagNameById.get(id)).filter((n): n is string => !!n)}
        />
      )}
      ListEmptyComponent={
        <CmpText variant="muted" className="mt-10 text-center">
          {empty}
        </CmpText>
      }
      onEndReachedThreshold={0.5}
      onEndReached={() => status === "CanLoadMore" && loadMore(PAGE_SIZE)}
      ListFooterComponent={status === "LoadingMore" ? <ActivityIndicator /> : null}
    />
  );
}
