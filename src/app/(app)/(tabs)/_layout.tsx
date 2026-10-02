import { Tabs } from "expo-router";
import { Bell, Settings, Tag } from "lucide-react-native";
import { useTranslation } from "react-i18next";

export default function TabsLayout() {
  const { t } = useTranslation();
  return (
    <Tabs screenOptions={{ headerTitleAlign: "left" }}>
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
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tabs.settings"),
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
