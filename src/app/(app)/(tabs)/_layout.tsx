import { router, Tabs } from "expo-router";
import { Bell, Settings, Tag } from "lucide-react-native";
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

export default function TabsLayout() {
  const { t } = useTranslation();
  return (
    <Tabs
      screenOptions={{
        headerTitleAlign: "left",
        headerRight: () => <SettingsButton />,
        // Lines the icon up with the content's 16px gutter (the ghost button
        // already adds 10px around the icon).
        headerRightContainerStyle: { paddingRight: 4 },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.reminders"),
          tabBarIcon: ({ color, size }) => <Bell color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="tags"
        options={{
          title: t("tabs.tags"),
          tabBarIcon: ({ color, size }) => <Tag color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
