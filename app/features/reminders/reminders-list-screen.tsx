import { CmpButton } from '@/components/cmp/cmp-button';
import { CmpFlatList } from '@/components/cmp/cmp-flat-list';
import { CmpIcon } from '@/components/cmp/cmp-icon';
import { CmpText } from '@/components/cmp/cmp-text';
import { useFabBottom, useFabContentPadding } from '@/features/reminders/fab-layout';
import { ReminderCard } from '@/features/reminders/reminder-card';
import { SearchBar } from '@/features/reminders/search-bar';
import { StatusFilter } from '@/features/reminders/status-filter';
import { useReminderList } from '@/features/reminders/use-reminder-list';
import { type ReminderStatus } from '@/lib/reminders';
import { Link } from 'expo-router';
import { PlusIcon } from 'lucide-react-native';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function RemindersListScreen() {
  const insets = useSafeAreaInsets();
  const fabBottom = useFabBottom();
  const fabContentPadding = useFabContentPadding();
  const { t } = useTranslation();
  const list = useReminderList();

  return (
    <>
      {/* No header — the tab bar carries navigation identity, so the screen
          owns its own top inset. */}
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        {list.error ? (
          <CmpText className="p-4 text-sm text-destructive">{list.error}</CmpText>
        ) : null}
        <View className="pt-4">
          <StatusFilter value={list.status} onChange={list.setStatus} />
        </View>
        <View className="px-4 pt-3">
          <SearchBar
            value={list.query}
            onChangeText={list.setQuery}
            placeholder={t('reminders.searchPlaceholder')}
          />
        </View>
        <CmpFlatList
          data={list.items}
          keyExtractor={(r) => r.id}
          contentContainerClassName="gap-3 p-4"
          contentContainerStyle={{ paddingBottom: fabContentPadding }}
          // Without this the first tap on a card is swallowed to dismiss the
          // search keyboard instead of opening the reminder.
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} />}
          onEndReached={list.loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            list.loadingMore ? <ActivityIndicator className="py-4" size="small" /> : null
          }
          ListEmptyComponent={
            list.loading ? null : <EmptyState searching={list.searching} status={list.status} />
          }
          renderItem={({ item }) => (
            <ReminderCard reminder={item} onToggleActive={list.setActive} />
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
