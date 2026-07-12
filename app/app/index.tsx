import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { describeError } from '@/lib/errors';
import { pb } from '@/lib/pb';
import { formatLocal, isFinished, type Reminder } from '@/lib/reminders';
import { Link, Stack, useFocusEffect, useRouter } from 'expo-router';
import { LogOutIcon, PlusIcon, SettingsIcon } from 'lucide-react-native';
import * as React from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';

export default function HomeScreen() {
  const [reminders, setReminders] = React.useState<Reminder[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const records = await pb
        .collection('reminders')
        .getFullList<Reminder>({ sort: 'next_fire' });
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
          title: 'Reminders',
          headerRight: () => <HeaderActions />,
        }}
      />
      <View className="flex-1 bg-background">
        {error ? (
          <Text className="p-4 text-sm text-destructive">{error}</Text>
        ) : null}
        <FlatList
          data={reminders}
          keyExtractor={(r) => r.id}
          contentContainerClassName="gap-3 p-4 pb-24"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            loading ? null : (
              <View className="items-center gap-4 pt-24">
                <Text className="text-lg font-semibold">No reminders yet</Text>
                <Text className="text-center text-sm text-muted-foreground">
                  Tap “New reminder” to create your first one. Make sure your ntfy server is
                  configured in Settings.
                </Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <ReminderCard reminder={item} onToggleActive={onToggleActive} />
          )}
        />
        <View className="absolute bottom-6 right-6">
          <Link href="/reminder/new" asChild>
            <Button size="lg">
              <Icon as={PlusIcon} className="text-primary-foreground" />
              <Text>New reminder</Text>
            </Button>
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
  const finished = isFinished(reminder);
  return (
    <Pressable onPress={() => router.push(`/reminder/${reminder.id}`)}>
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle className="flex-1" numberOfLines={1}>
            {reminder.title}
          </CardTitle>
          {finished ? (
            <Badge variant="secondary">
              <Text>Finished</Text>
            </Badge>
          ) : (
            <Switch
              checked={reminder.active}
              onCheckedChange={(checked) => onToggleActive(reminder, checked)}
            />
          )}
        </CardHeader>
        <CardContent className="gap-1">
          <Text className="text-sm text-muted-foreground">
            {finished
              ? `Done — fired ${reminder.fired_count}×`
              : reminder.active
                ? `Next: ${formatLocal(reminder.next_fire)}`
                : 'Paused'}
          </Text>
          {reminder.last_error ? (
            <Text className="text-sm text-destructive" numberOfLines={2}>
              Last send failed: {reminder.last_error}
            </Text>
          ) : null}
        </CardContent>
      </Card>
    </Pressable>
  );
}

function HeaderActions() {
  return (
    <View className="flex-row">
      <Link href="/settings" asChild>
        <Button variant="ghost" size="icon">
          <Icon as={SettingsIcon} className="size-5" />
        </Button>
      </Link>
      <Button
        variant="ghost"
        size="icon"
        onPress={() => {
          pb.authStore.clear();
        }}>
        <Icon as={LogOutIcon} className="size-5" />
      </Button>
    </View>
  );
}
