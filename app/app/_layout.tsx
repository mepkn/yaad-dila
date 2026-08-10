import '@/global.css';

import i18n from '@/lib/i18n';
import { getStoredLanguage } from '@/lib/locale-preference';
import { NAV_THEME } from '@/lib/theme';
import { getStoredTheme } from '@/lib/theme-preference';
import { authReady, pb } from '@/lib/pb';
import { ThemeProvider } from 'expo-router/react-navigation';
import { PortalHost } from '@rn-primitives/portal';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { configureReanimatedLogger } from 'react-native-reanimated';

// Library code (keyboard-controller / RNR animations) trips Reanimated's
// dev-only strict warnings; we write no Reanimated code ourselves.
configureReanimatedLogger({ strict: false });

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export default function RootLayout() {
  const { t } = useTranslation();
  const { colorScheme, setColorScheme } = useColorScheme();
  const [ready, setReady] = React.useState(false);
  const [loggedIn, setLoggedIn] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    getStoredTheme().then((stored) => {
      if (mounted && stored) setColorScheme(stored);
    });
    getStoredLanguage().then((stored) => {
      if (mounted && stored && stored !== i18n.language) i18n.changeLanguage(stored);
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

  return (
    <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
      <ThemeProvider value={NAV_THEME[colorScheme ?? 'light']}>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        {ready ? (
          <Stack>
            <Stack.Protected guard={loggedIn}>
              {/* The tab navigator draws its own bar; a root header above it
                would be a second, redundant chrome layer. */}
              {/* The title is never drawn (headerShown is false) but it IS what
                  the detail screen's back button inherits — without it, iOS
                  labels that button with the route name, literally "(tabs)".
                  `minimal` hides the text; the title keeps VoiceOver sensible. */}
              <Stack.Screen
                name="(tabs)"
                options={{ headerShown: false, title: t('common.appName') }}
              />
              <Stack.Screen
                name="reminder/[id]"
                options={{ headerBackButtonDisplayMode: 'minimal' }}
              />
            </Stack.Protected>
            <Stack.Protected guard={!loggedIn}>
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            </Stack.Protected>
          </Stack>
        ) : null}
        <PortalHost />
      </ThemeProvider>
    </KeyboardProvider>
  );
}
