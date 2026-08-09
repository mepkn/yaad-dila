import { CmpButton } from '@/components/cmp/cmp-button';
import { CmpFlatList } from '@/components/cmp/cmp-flat-list';
import { CmpIcon } from '@/components/cmp/cmp-icon';
import { CmpText } from '@/components/cmp/cmp-text';
import { ReminderCard } from '@/features/reminders/reminder-card';
import { SearchBar } from '@/features/reminders/search-bar';
import { StatusFilter } from '@/features/reminders/status-filter';
import { describeError } from '@/lib/errors';
import { pb } from '@/lib/pb';
import { parseUTC, statusOf, type Reminder, type ReminderStatus } from '@/lib/reminders';
import { matchesSearch, parseSearchQuery } from '@/lib/search';
import { Link, Stack, useFocusEffect } from 'expo-router';
import { setStoredTheme } from '@/lib/theme-preference';
import { LogOutIcon, MoonIcon, PlusIcon, SettingsIcon, SunIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Image, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BUCKET_ORDER = { upcoming: 0, paused: 1, past: 2 } as const;

// The API sorts by `next_fire` ascending, but the backend never clears
// `next_fire` when a reminder finishes — it only flips `active` — so finished
// reminders keep a stale past timestamp and would otherwise sort to the very
// top. Re-order here: soonest-first for anything still scheduled, and
// most-recently-fired-first for what is done.
function sortForDisplay(reminders: Reminder[], status: ReminderStatus): Reminder[] {
  const filtered = status === 'all' ? reminders : reminders.filter((r) => statusOf(r) === status);

  return [...filtered].sort((a, b) => {
    const bucketA = statusOf(a);
    const bucketB = statusOf(b);
    if (bucketA !== bucketB) return BUCKET_ORDER[bucketA] - BUCKET_ORDER[bucketB];

    const timeA = parseUTC(a.next_fire).getTime();
    const timeB = parseUTC(b.next_fire).getTime();
    if (isNaN(timeA) || isNaN(timeB)) return 0;
    return bucketA === 'past' ? timeB - timeA : timeA - timeB;
  });
}

export function RemindersListScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [reminders, setReminders] = React.useState<Reminder[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');
  // Filter state is deliberately not persisted: every visit to home starts at
  // "all", so a reminder can never be missing because of a forgotten filter.
  const [status, setStatus] = React.useState<ReminderStatus>('all');

  // `reminders` stays the unfiltered source of truth so the optimistic toggle
  // and reload keep working regardless of what is being filtered or searched.
  const parsedQuery = React.useMemo(() => parseSearchQuery(query), [query]);
  const byStatus = React.useMemo(() => sortForDisplay(reminders, status), [reminders, status]);
  const visibleReminders = React.useMemo(
    () => byStatus.filter((reminder) => matchesSearch(reminder, parsedQuery)),
    [byStatus, parsedQuery]
  );
  const searching = parsedQuery.tags.length > 0 || parsedQuery.text.length > 0;

  const load = React.useCallback(async () => {
    try {
      const records = await pb
        .collection('reminders')
        .getFullList<Reminder>({ sort: 'next_fire', expand: 'tags' });
      setReminders(records);
      setError(null);
    } catch (err) {
      setError(describeError(err));
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      let mounted = true;
      load().finally(() => {
        if (mounted) setLoading(false);
      });
      return () => {
        mounted = false;
      };
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function onToggleActive(reminder: Reminder, active: boolean) {
    // Optimistic flip; reload settles the truth either way.
    setReminders((prev) => prev.map((r) => (r.id === reminder.id ? { ...r, active } : r)));
    try {
      await pb.collection('reminders').update(reminder.id, { active });
    } catch (err) {
      setError(describeError(err));
    }
    await load();
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: t('common.appName'),
          headerTitle: () => (
            <View className="flex-row items-center gap-2">
              <Image source={require('@/assets/images/icon.png')} className="h-7 w-7 rounded-lg" />
              <CmpText className="text-lg font-semibold text-foreground">
                {t('common.appName')}
              </CmpText>
            </View>
          ),
          headerRight: () => <HeaderActions />,
        }}
      />
      <View className="flex-1 bg-background">
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
          data={visibleReminders}
          keyExtractor={(r) => r.id}
          contentContainerClassName="gap-3 p-4"
          contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
          // Without this the first tap on a card is swallowed to dismiss the
          // search keyboard instead of opening the reminder.
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={loading ? null : <EmptyState searching={searching} status={status} />}
          renderItem={({ item }) => (
            <ReminderCard reminder={item} onToggleActive={onToggleActive} />
          )}
        />
        <View className="absolute right-6" style={{ bottom: insets.bottom + 24 }}>
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

function HeaderActions() {
  const { colorScheme, setColorScheme } = useColorScheme();
  return (
    <View className="flex-row">
      <CmpButton
        variant="ghost"
        size="icon"
        onPress={() => {
          const next = colorScheme === 'dark' ? 'light' : 'dark';
          setColorScheme(next);
          setStoredTheme(next);
        }}>
        <CmpIcon as={colorScheme === 'dark' ? SunIcon : MoonIcon} className="size-5" />
      </CmpButton>
      <Link href="/settings" asChild>
        <CmpButton variant="ghost" size="icon">
          <CmpIcon as={SettingsIcon} className="size-5" />
        </CmpButton>
      </Link>
      <CmpButton
        variant="ghost"
        size="icon"
        onPress={() => {
          pb.authStore.clear();
        }}>
        <CmpIcon as={LogOutIcon} className="size-5" />
      </CmpButton>
    </View>
  );
}
