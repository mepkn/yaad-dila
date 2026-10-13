import { usePaginatedQuery } from "convex/react";
import { useFocusEffect } from "expo-router";
import { Search } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { type TextInput, View } from "react-native";
import { api } from "@convex/_generated/api";
import { CmpInput } from "@/components/cmp/cmp-field";
import { CmpIcon } from "@/components/cmp/cmp-icon";
import { CmpText } from "@/components/cmp/cmp-text";
import { PAGE_SIZE, ReminderList } from "@/components/reminder-list";
import { cn } from "@/lib/utils";

const SEARCH_DELAY_MS = 250;

// Searches every reminder on the server, in any status. The query stays while
// the app is open (tab screens stay mounted).
export default function SearchScreen() {
  const { t } = useTranslation();
  const input = useRef<TextInput>(null);
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setQuery(text.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(id);
  }, [text]);

  // Opening the tab puts the cursor in the box.
  useFocusEffect(
    useCallback(() => {
      input.current?.focus();
    }, []),
  );

  const results = usePaginatedQuery(api.reminders.search, query ? { query } : "skip", {
    initialNumItems: PAGE_SIZE,
  });

  return (
    <View className="bg-background flex-1">
      <View
        className={cn(
          "border-b px-4 pb-3 pt-3",
          scrolled ? "border-border" : "border-transparent",
        )}>
        <View className="relative justify-center">
          <View className="absolute left-3 z-10" pointerEvents="none">
            <CmpIcon as={Search} size={16} className="text-muted-foreground" />
          </View>
          <CmpInput
            ref={input}
            className="pl-9"
            placeholder={t("reminders.searchPlaceholder")}
            value={text}
            onChangeText={setText}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
      </View>
      {query ? (
        <ReminderList
          results={results.results}
          status={results.status}
          loadMore={results.loadMore}
          empty={t("reminders.noMatches")}
          contentContainerClassName="gap-3 px-4 pb-10 pt-1"
          onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > 0)}
        />
      ) : (
        <CmpText variant="muted" className="mt-10 px-4 text-center">
          {t("reminders.searchHint")}
        </CmpText>
      )}
    </View>
  );
}
