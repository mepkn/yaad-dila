import { router, Tabs } from "expo-router";
import { Bell, Search, Settings, Tag } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { CmpButton } from "@/components/cmp/cmp-button";

function SettingsButton() {
  const { t } = useTranslation();
  return (
    <CmpButton
      variant="ghost"
      size="icon"
      icon={Settings}
      label={t("tabs.settings")}
      onPress={() => router.push("/settings")}
    />
  );
}

// title stays the app name (it's also the browser tab title on web);
// tabBarLabel and headerTitle name the tab.
export default function TabsLayout() {
  const { t } = useTranslation();
  return (
    <Tabs
      screenOptions={{
        headerTitleAlign: "left",
        title: t("common.appName"),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          headerTitle: t("common.appName"),
          headerRight: () => <SettingsButton />,
          // Lines the icon up with the content's 16px gutter (the ghost button
          // already adds 10px around the icon).
          headerRightContainerStyle: { paddingRight: 4 },
          tabBarLabel: t("tabs.reminders"),
          tabBarIcon: ({ color, size }) => <Bell color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="tags"
        options={{
          headerTitle: t("tabs.tags"),
          tabBarLabel: t("tabs.tags"),
          tabBarIcon: ({ color, size }) => <Tag color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          headerTitle: t("tabs.search"),
          tabBarLabel: t("tabs.search"),
          tabBarIcon: ({ color, size }) => <Search color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
