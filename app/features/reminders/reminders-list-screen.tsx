import { CmpButton } from '@/components/cmp/cmp-button';
import { CmpFlatList } from '@/components/cmp/cmp-flat-list';
import { CmpIcon } from '@/components/cmp/cmp-icon';
import { CmpText } from '@/components/cmp/cmp-text';
import { useFabBottom, useFabContentPadding } from '@/features/reminders/fab-layout';
import { ReminderCard } from '@/features/reminders/reminder-card';
import { SearchBar } from '@/features/reminders/search-bar';
import { StatusFilter } from '@/features/reminders/status-filter';
import { describeError } from '@/lib/errors';
import { consumeRemindersDirty } from '@/lib/reminders-dirty';
import {
  isSearching,
  listReminders,
  setReminderActive,
  statusOf,
  type Reminder,
  type ReminderStatus,
} from '@/lib/reminders';
import { Link, useFocusEffect } from 'expo-router';
import { PlusIcon } from 'lucide-react-native';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SEARCH_DEBOUNCE_MS = 300;

export function RemindersListScreen() {
  const insets = useSafeAreaInsets();
  const fabBottom = useFabBottom();
  const fabContentPadding = useFabContentPadding();
  const { t } = useTranslation();
  const [reminders, setReminders] = React.useState<Reminder[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');
  const [debouncedQuery, setDebouncedQuery] = React.useState('');
  // Filter state is deliberately not persisted: every visit to home starts at
  // "all", so a reminder can never be missing because of a forgotten filter.
  const [status, setStatus] = React.useState<ReminderStatus>('all');

  const page = React.useRef(1);
  // Every fetch takes a ticket; a response whose ticket is stale is dropped, so
  // a slow reply for an old query can never overwrite newer results.
  const requestId = React.useRef(0);

  const searching = isSearching(debouncedQuery);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const fetchPage = React.useCallback(
    async (pageNum: number, replace: boolean) => {
      const ticket = ++requestId.current;
      try {
        const result = await listReminders({
          page: pageNum,
          status,
          query: debouncedQuery,
          append: !replace,
        });

        // null means the request was aborted in favour of a newer one.
        if (!result) return;
        if (ticket !== requestId.current) return;

        page.current = pageNum;
        setHasMore(result.hasMore);
        setReminders((prev) => (replace ? result.items : [...prev, ...result.items]));
        setError(null);
      } catch (err) {
        if (ticket !== requestId.current) return;
        setError(describeError(err));
      }
    },
    [status, debouncedQuery]
  );

  const reload = React.useCallback(() => {
    let active = true;
    setLoading(true);
    fetchPage(1, true).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [fetchPage]);

  // First mount, and every time the query shape changes.
  React.useEffect(reload, [reload]);

  // On focus we only refetch when a mutation actually happened. Reloading on
  // every focus would throw away the appended pages and the scroll position
  // just because the user opened a reminder and came back. Server-side changes
  // (a cron fire flipping a reminder to done) are picked up by pull-to-refresh.
  useFocusEffect(
    React.useCallback(() => {
      if (!consumeRemindersDirty()) return;
      return reload();
    }, [reload])
  );

  async function loadMore() {
    // onEndReached fires repeatedly while the user sits at the bottom; without
    // these guards it stacks duplicate requests for the same page.
    if (!hasMore || loadingMore || loading || refreshing) return;
    setLoadingMore(true);
    await fetchPage(page.current + 1, false);
    setLoadingMore(false);
  }

  async function onRefresh() {
    setRefreshing(true);
    await fetchPage(1, true);
    setRefreshing(false);
  }

  async function onToggleActive(reminder: Reminder, active: boolean) {
    // Patch in place rather than refetching: a reload would reset pagination
    // and throw away the user's scroll position.
    setReminders((prev) => prev.map((r) => (r.id === reminder.id ? { ...r, active } : r)));
    try {
      await setReminderActive(reminder.id, active);
      // Only drop the row once the server has agreed. Removing it optimistically
      // would mean a failed update has to re-insert it at the right position,
      // which a map() can no longer do.
      if (status !== 'all') {
        setReminders((prev) => prev.filter((r) => statusOf(r) === status));
      }
    } catch (err) {
      setError(describeError(err));
      setReminders((prev) => prev.map((r) => (r.id === reminder.id ? reminder : r)));
    }
  }

  return (
    <>
      {/* No header — the tab bar carries navigation identity, so the screen
          owns its own top inset. */}
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        {error ? <CmpText className="p-4 text-sm text-destructive">{error}</CmpText> : null}
        <View className="pt-4">
          <StatusFilter value={status} onChange={setStatus} />
        </View>
        <View className="px-4 pt-3">
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder={t('reminders.searchPlaceholder')}
          />
        </View>
        <CmpFlatList
          data={reminders}
          keyExtractor={(r) => r.id}
          contentContainerClassName="gap-3 p-4"
          contentContainerStyle={{ paddingBottom: fabContentPadding }}
          // Without this the first tap on a card is swallowed to dismiss the
          // search keyboard instead of opening the reminder.
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator className="py-4" size="small" /> : null
          }
          ListEmptyComponent={loading ? null : <EmptyState searching={searching} status={status} />}
          renderItem={({ item }) => (
            <ReminderCard reminder={item} onToggleActive={onToggleActive} />
          )}
        />
        {/* Shares its offset with the voice FAB on the new-reminder form so the
            button does not jump between screens — see fab-layout.ts. */}
        <View className="absolute right-6" style={{ bottom: fabBottom }}>
          <Link href="/reminder/new" asChild>
            <CmpButton
              size="icon"
              className="h-14 w-14 rounded-full"
              accessibilityLabel={t('reminders.newReminder')}>
              <CmpIcon as={PlusIcon} className="size-6 text-primary-foreground" />
            </CmpButton>
          </Link>
        </View>
      </View>
    </>
  );
}

// Three distinct dead ends, each with its own copy: the search found nothing,
// the selected bucket is empty, or there are no reminders at all.
function EmptyState({ searching, status }: { searching: boolean; status: ReminderStatus }) {
  const { t } = useTranslation();

  const [titleKey, bodyKey] = searching
    ? ['reminders.noResultsTitle', 'reminders.noResultsBody']
    : status === 'all'
      ? ['reminders.emptyTitle', 'reminders.emptyBody']
      : [`reminders.empty${capitalize(status)}Title`, `reminders.empty${capitalize(status)}Body`];

  return (
    <View className="items-center gap-4 pt-24">
      <CmpText className="text-lg font-semibold">{t(titleKey)}</CmpText>
      <CmpText className="text-center text-sm text-muted-foreground">{t(bodyKey)}</CmpText>
    </View>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
