import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// NativeTabs does not expose its bar height at runtime, so this is a measured
// constant per platform. iOS 26's floating pill spans all the way to the screen
// bottom (83pt on iPhone 17 Pro, home indicator included); Android's Material 3
// bar sits *above* the navigation inset, so that inset adds on there.
//
// The FAB clears the bar vertically rather than sitting beside it: the iOS pill
// widens with each tab added, so horizontal clearance would break as soon as
// the app grows past two tabs.
const TAB_BAR_HEIGHT = Platform.select({ ios: 83, android: 80, default: 80 })!;
const FAB_GAP = 12;
const FAB_SIZE = 56; // h-14 / w-14

/**
 * Distance from the screen bottom to a FAB's bottom edge.
 *
 * The new-reminder form has no tab bar, but it uses this same value on purpose:
 * the button must not shift position as the user moves between the two screens.
 */
export function useFabBottom(): number {
  const insets = useSafeAreaInsets();
  return (Platform.OS === 'android' ? insets.bottom : 0) + TAB_BAR_HEIGHT + FAB_GAP;
}

/** Scroll padding so the last row clears both the FAB and the tab bar. */
export function useFabContentPadding(): number {
  return useFabBottom() + FAB_SIZE + 16;
}
