import { CmpButton } from '@/components/cmp/cmp-button';
import { CmpIcon } from '@/components/cmp/cmp-icon';
import { CmpInput } from '@/components/cmp/cmp-input';
import { SearchIcon, XIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

interface SearchBarProps {
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChangeText, placeholder }: SearchBarProps) {
  const { t } = useTranslation();
  return (
    <View className="h-10 w-full flex-row items-center gap-2 rounded-md border border-input bg-background px-3 shadow-sm shadow-black/5">
      <CmpIcon as={SearchIcon} className="size-4 text-muted-foreground" />
      <CmpInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        // Tag tokens are lowercase codes — autocapitalise/autocorrect fight "#birthday".
        autoCapitalize="none"
        autoCorrect={false}
        // dark:bg-transparent as well as bg-transparent: the base input carries
        // `dark:bg-input/30`, and a plain utility can't cancel a dark variant —
        // without this the input paints grey over the middle of the bar while
        // the icon and the clear button stay on the container's background.
        className="h-8 flex-1 border-0 bg-transparent px-0 py-0 shadow-none dark:bg-transparent"
      />
      {value.length > 0 ? (
        <CmpButton
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-full"
          accessibilityLabel={t('reminders.searchClear')}
          onPress={() => onChangeText('')}>
          <CmpIcon as={XIcon} className="size-3.5 text-muted-foreground" />
        </CmpButton>
      ) : null}
    </View>
  );
}
