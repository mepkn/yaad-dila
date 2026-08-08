import { CmpBadge } from '@/components/cmp/cmp-badge';
import { CmpButton } from '@/components/cmp/cmp-button';
import { CmpCard, CmpCardContent, CmpCardHeader, CmpCardTitle } from '@/components/cmp/cmp-card';
import { CmpFlatList } from '@/components/cmp/cmp-flat-list';
import { CmpIcon } from '@/components/cmp/cmp-icon';
import { CmpSwitch } from '@/components/cmp/cmp-switch';
import { CmpText } from '@/components/cmp/cmp-text';
import { describeError } from '@/lib/errors';
import { pb } from '@/lib/pb';
import { formatLocal, isFinished, type Reminder } from '@/lib/reminders';
import { Link, Stack, useFocusEffect, useRouter } from 'expo-router';
import { setStoredTheme } from '@/lib/theme-preference';
import { LogOutIcon, MoonIcon, PlusIcon, SettingsIcon, SunIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [reminders, setReminders] = React.useState<Reminder[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const records = await pb.collection('reminders').getFullList<Reminder>({ sort: 'next_fire' });
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
        <CmpFlatList
          data={reminders}
          keyExtractor={(r) => r.id}
          contentContainerClassName="gap-3 p-4"
          contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            loading ? null : (
              <View className="items-center gap-4 pt-24">
                <CmpText className="text-lg font-semibold">{t('reminders.emptyTitle')}</CmpText>
                <CmpText className="text-center text-sm text-muted-foreground">
                  {t('reminders.emptyBody')}
                </CmpText>
              </View>
            )
          }
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

function ReminderCard({
  reminder,
  onToggleActive,
}: {
  reminder: Reminder;
  onToggleActive: (reminder: Reminder, active: boolean) => void;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const finished = isFinished(reminder);
  return (
    <Pressable onPress={() => router.push(`/reminder/${reminder.id}`)}>
      <CmpCard>
        <CmpCardHeader className="flex-row items-center justify-between gap-3">
          <CmpCardTitle className="flex-1" numberOfLines={1}>
            {reminder.title}
          </CmpCardTitle>
          {finished ? (
            <CmpBadge variant="secondary">
              <CmpText>{t('reminders.finished')}</CmpText>
            </CmpBadge>
          ) : (
            <CmpSwitch
              checked={reminder.active}
              onCheckedChange={(checked) => onToggleActive(reminder, checked)}
            />
          )}
        </CmpCardHeader>
        <CmpCardContent className="gap-1">
          <CmpText className="text-sm text-muted-foreground">
            {finished
              ? t('reminders.doneFired', { count: reminder.fired_count })
              : reminder.active
                ? t('reminders.next', { date: formatLocal(reminder.next_fire) })
                : t('reminders.paused')}
          </CmpText>
          {reminder.last_error ? (
            <CmpText className="text-sm text-destructive" numberOfLines={2}>
              {t('reminders.lastSendFailed', { error: reminder.last_error })}
            </CmpText>
          ) : null}
        </CmpCardContent>
      </CmpCard>
    </Pressable>
  );
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
