import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { CalendarDays, Clock } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, View } from "react-native";
import { CmpButton } from "@/components/cmp/cmp-button";
import { formatDate, formatTime } from "@/lib/format";

type Props = {
  value: number;
  onChange: (value: number) => void;
};

// Date and time buttons that open the platform pickers. Values are UTC ms;
// the pickers work in the device's local time.
export function DateTimeField({ value, onChange }: Props) {
  const { t, i18n } = useTranslation();
  const [iosMode, setIosMode] = useState<"date" | "time" | null>(null);

  function merge(picked: Date, mode: "date" | "time") {
    const next = new Date(value);
    if (mode === "date") next.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
    else next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
    onChange(next.getTime());
  }

  function open(mode: "date" | "time") {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: new Date(value),
        mode,
        onChange: (event, date) => {
          if (event.type === "set" && date) merge(date, mode);
        },
      });
    } else {
      setIosMode(iosMode === mode ? null : mode);
    }
  }

  return (
    <View className="gap-2">
      <View className="flex-row gap-2">
        <CmpButton
          variant="outline"
          className="flex-1"
          icon={CalendarDays}
          label={formatDate(value, i18n.language)}
          accessibilityHint={t("form.date")}
          onPress={() => open("date")}
        />
        <CmpButton
          variant="outline"
          icon={Clock}
          label={formatTime(value, i18n.language)}
          accessibilityHint={t("form.time")}
          onPress={() => open("time")}
        />
      </View>
      {iosMode && (
        <DateTimePicker
          value={new Date(value)}
          mode={iosMode}
          display="spinner"
          onChange={(_, date) => date && merge(date, iosMode)}
        />
      )}
    </View>
  );
}
