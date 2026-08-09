import { CmpBadge } from '@/components/cmp/cmp-badge';
import { CmpButton } from '@/components/cmp/cmp-button';
import { CmpIcon } from '@/components/cmp/cmp-icon';
import { CmpInput } from '@/components/cmp/cmp-input';
import { CmpText } from '@/components/cmp/cmp-text';
import { normalizeTagName, type SelectedTag, type Tag } from '@/lib/tags';
import { XIcon } from 'lucide-react-native';
import * as React from 'react';
import { type NativeSyntheticEvent, type TextInputKeyPressEventData, View } from 'react-native';
import { useTranslation } from 'react-i18next';

interface TagInputProps {
  value: SelectedTag[];
  onChange: (next: SelectedTag[]) => void;
  available: Tag[];
  editable?: boolean;
  placeholder?: string;
}

export function TagInput({
  value,
  onChange,
  available,
  editable = true,
  placeholder,
}: TagInputProps) {
  const { t } = useTranslation();
  const [text, setText] = React.useState('');
  const normalized = normalizeTagName(text);
  const normalizedLower = normalized.toLowerCase();
  const selectedNames = new Set(value.map((tag) => tag.name.toLowerCase()));
  const suggestions = normalized
    ? available
        .filter(
          (tag) =>
            tag.name.toLowerCase().includes(normalizedLower) &&
            !selectedNames.has(tag.name.toLowerCase())
        )
        .slice(0, 6)
    : [];
  const matchesExisting = available.some((tag) => tag.name.toLowerCase() === normalizedLower);
  const canCreate =
    normalized.length > 0 && !matchesExisting && !selectedNames.has(normalizedLower);

  function selectTag(tag: SelectedTag) {
    onChange([...value, tag]);
    setText('');
  }

  function submitText() {
    if (suggestions[0]) {
      selectTag({ id: suggestions[0].id, name: suggestions[0].name });
    } else if (canCreate) {
      selectTag({ name: normalized });
    }
  }

  function onKeyPress(event: NativeSyntheticEvent<TextInputKeyPressEventData>) {
    if (event.nativeEvent.key === 'Backspace' && text.length === 0 && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  const showOptions = editable && normalized.length > 0 && (suggestions.length > 0 || canCreate);

  return (
    <View className="gap-1.5">
      <View
        className={`min-h-10 w-full flex-row flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1 shadow-sm shadow-black/5 ${editable ? '' : 'opacity-50'}`}>
        {value.map((tag) => (
          <CmpBadge
            key={tag.id ?? tag.name.toLowerCase()}
            variant="secondary"
            className="gap-0.5 pr-0.5">
            <CmpText className="text-xs">{tag.name}</CmpText>
            <CmpButton
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-full"
              disabled={!editable}
              accessibilityLabel={t('reminder.tagRemove', { name: tag.name })}
              onPress={() => onChange(value.filter((candidate) => candidate !== tag))}>
              <CmpIcon as={XIcon} className="size-3.5 text-secondary-foreground" />
            </CmpButton>
          </CmpBadge>
        ))}
        <CmpInput
          value={text}
          onChangeText={setText}
          onKeyPress={onKeyPress}
          onSubmitEditing={submitText}
          blurOnSubmit={false}
          editable={editable}
          placeholder={value.length === 0 ? placeholder : undefined}
          className="h-8 min-w-32 flex-1 border-0 bg-transparent px-1 py-0 shadow-none"
        />
      </View>
      {showOptions ? (
        <View className="overflow-hidden rounded-md border border-border bg-background">
          {suggestions.map((tag) => (
            <CmpButton
              key={tag.id}
              variant="ghost"
              className="h-10 justify-start rounded-none px-3"
              onPress={() => selectTag({ id: tag.id, name: tag.name })}>
              <CmpText className="text-sm">{tag.name}</CmpText>
            </CmpButton>
          ))}
          {canCreate ? (
            <CmpButton
              variant="ghost"
              className="h-10 justify-start rounded-none px-3"
              onPress={() => selectTag({ name: normalized })}>
              <CmpText className="text-sm">
                + {t('reminder.tagCreate', { name: normalized })}
              </CmpText>
            </CmpButton>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
