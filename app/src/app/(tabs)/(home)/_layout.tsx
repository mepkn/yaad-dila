import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

// The reminder form lives inside this tab rather than the root stack, so the
// tab bar stays visible while it is open. NativeTabs render no headers, so the
// form gets its header and back button from this Stack.
export default function HomeStack() {
  const { t } = useTranslation();

  return (
    <Stack>
      {/* The list draws its own top inset; a header here would duplicate the
          chrome the tab bar already provides. The title is never drawn but it
          IS what the pushed screen's back button inherits — without it, iOS
          labels that button with the route name. */}
      <Stack.Screen name="index" options={{ headerShown: false, title: t('common.appName') }} />
      <Stack.Screen name="reminder/[id]" options={{ headerBackButtonDisplayMode: 'minimal' }} />
    </Stack>
  );
}
