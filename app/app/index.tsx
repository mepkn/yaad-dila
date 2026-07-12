import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { pb } from '@/lib/pb';
import { Link, Stack } from 'expo-router';
import { LogOutIcon, SettingsIcon } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

export default function HomeScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: 'Reminders',
          headerRight: () => <HeaderActions />,
        }}
      />
      <View className="flex-1 items-center justify-center gap-4 bg-background p-4">
        <Text className="text-lg font-semibold">No reminders yet</Text>
        <Text className="text-center text-sm text-muted-foreground">
          Reminder list and creation arrive in Phase 3. For now, set up your ntfy server in
          Settings and send a test notification.
        </Text>
        <Link href="/settings" asChild>
          <Button>
            <Icon as={SettingsIcon} className="text-primary-foreground" />
            <Text>ntfy settings</Text>
          </Button>
        </Link>
      </View>
    </>
  );
}

function HeaderActions() {
  return (
    <Button
      variant="ghost"
      size="icon"
      onPress={() => {
        pb.authStore.clear();
      }}>
      <Icon as={LogOutIcon} className="size-5" />
    </Button>
  );
}
