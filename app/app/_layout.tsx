import '@/global.css';

import { NAV_THEME } from '@/lib/theme';
import { getStoredTheme } from '@/lib/theme-preference';
import { authReady, pb } from '@/lib/pb';
import { ThemeProvider } from 'expo-router/react-navigation';
import { PortalHost } from '@rn-primitives/portal';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { KeyboardProvider } from 'react-native-keyboard-controller';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export default function RootLayout() {
  const { colorScheme, setColorScheme } = useColorScheme();
  const router = useRouter();
  const segments = useSegments();
  const [ready, setReady] = React.useState(false);
  const [loggedIn, setLoggedIn] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    getStoredTheme().then((stored) => {
      if (mounted && stored) setColorScheme(stored);
    });
    authReady.then(() => {
      if (!mounted) return;
      setLoggedIn(pb.authStore.isValid);
      setReady(true);
    });
    const unsubscribe = pb.authStore.onChange(() => {
      setLoggedIn(pb.authStore.isValid);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  React.useEffect(() => {
    if (!ready) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!loggedIn && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (loggedIn && inAuthGroup) {
      router.replace('/');
    }
  }, [ready, loggedIn, segments, router]);

  return (
    <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
    <ThemeProvider value={NAV_THEME[colorScheme ?? 'light']}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      {ready ? (
        <Stack>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack>
      ) : null}
      <PortalHost />
    </ThemeProvider>
    </KeyboardProvider>
  );
}
