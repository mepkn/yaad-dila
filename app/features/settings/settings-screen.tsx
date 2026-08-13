import { CmpKeyboardAwareScrollView } from '@/components/cmp/cmp-keyboard-aware-scroll-view';
import { AccountSection } from '@/features/settings/account-section';
import { AppearanceSection } from '@/features/settings/appearance-section';
import { NotificationsSection } from '@/features/settings/notifications-section';
import { VoiceAiSection } from '@/features/settings/voice-ai-section';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Composition only. Each section owns its own state, its own loading, and its
 * own module below it — none of them share anything but the scroll container.
 */
export function SettingsScreen() {
  const insets = useSafeAreaInsets();

  return (
    <CmpKeyboardAwareScrollView
      className="flex-1 bg-background"
      contentContainerClassName="items-center gap-4 p-4"
      // iOS auto-adjusts a screen's first scroll view by the safe-area inset,
      // which would stack on top of the padding below and indent the first card
      // twice. Opting out keeps one source of truth and makes both platforms
      // behave the same. The bottom value must also clear the tab bar, which
      // NativeTabs does not let us measure.
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 96 }}
      bottomOffset={16}>
      <NotificationsSection />
      <VoiceAiSection />
      <AppearanceSection />
      <AccountSection />
    </CmpKeyboardAwareScrollView>
  );
}
