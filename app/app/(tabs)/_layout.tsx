import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTranslation } from 'react-i18next';

// Tab icons are the one place in the app that does not use lucide: NativeTabs
// renders platform icons natively, so it takes SF Symbol / Material Symbol
// names rather than a React component.
export default function TabsLayout() {
  const { t } = useTranslation();

  return (
    <NativeTabs>
      {/* `name` must match the route name INCLUDING the parentheses, or the tab
          renders blank rather than erroring.

          disableTransparentOnScrollEdge: the bar only stays opaque when a
          scrollable is the screen's first child, and on Home the list sits
          below the filter chips and search bar.

          disableAutomaticContentInsets: the reminder form nested in this tab
          IS a first-child scroll view, so NativeTabs would inset it on top of
          its own padding and indent it twice under the header. */}
      <NativeTabs.Trigger
        name="(home)"
        disableTransparentOnScrollEdge
        disableAutomaticContentInsets>
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
        <NativeTabs.Trigger.Label>{t('tabs.home')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      {/* Same reason as Settings below: the tag list applies its own
          insets.top, so NativeTabs must not inset it a second time. */}
      <NativeTabs.Trigger name="tags" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Icon sf="tag.fill" md="label" />
        <NativeTabs.Trigger.Label>{t('tabs.tags')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      {/* Settings scrolls, so NativeTabs would inset its scroll view by the
          safe area on top of the screen's own padding and indent the first card
          twice. Home is unaffected — its padding sits on a plain View. */}
      <NativeTabs.Trigger name="settings" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Icon sf="gearshape.fill" md="settings" />
        <NativeTabs.Trigger.Label>{t('tabs.settings')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
