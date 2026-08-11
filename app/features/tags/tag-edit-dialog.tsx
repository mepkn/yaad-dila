import { CmpButton } from '@/components/cmp/cmp-button';
import {
  CmpDialog,
  CmpDialogContent,
  CmpDialogFooter,
  CmpDialogHeader,
  CmpDialogTitle,
} from '@/components/cmp/cmp-dialog';
import { CmpInput } from '@/components/cmp/cmp-input';
import { CmpLabel } from '@/components/cmp/cmp-label';
import { CmpText } from '@/components/cmp/cmp-text';
import { describeError } from '@/lib/errors';
import { createTag, isUniqueConstraintError, normalizeTagName, renameTag } from '@/lib/tags';
import type { TagWithCount } from '@/lib/tags';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

interface TagEditDialogProps {
  /** The tag being renamed, or null when creating a new one. */
  tag: TagWithCount | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function TagEditDialog({ tag, open, onOpenChange, onSaved }: TagEditDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Reset on every open rather than on mount: the dialog stays mounted between
  // uses, so a stale name from the previous tag would otherwise leak in.
  React.useEffect(() => {
    if (open) {
      setName(tag?.name ?? '');
      setError(null);
    }
  }, [open, tag]);

  async function onSave() {
    const normalized = normalizeTagName(name);
    if (!normalized) {
      setError(t('tags.nameRequired'));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (tag) {
        await renameTag(tag.id, normalized);
      } else {
        await createTag(normalized);
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      // The unique index is per (user, name), so this is always "you already
      // have that tag" — describeError would surface a raw field message.
      setError(isUniqueConstraintError(err) ? t('tags.duplicate') : describeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <CmpDialog open={open} onOpenChange={onOpenChange}>
      <CmpDialogContent>
        <CmpDialogHeader>
          <CmpDialogTitle>{tag ? t('tags.renameTitle') : t('tags.createTitle')}</CmpDialogTitle>
        </CmpDialogHeader>
        <View className="gap-1.5">
          <CmpLabel nativeID="tag-name">{t('tags.nameLabel')}</CmpLabel>
          <CmpInput
            aria-labelledby="tag-name"
            value={name}
            // Editing the name is what makes a "already taken" complaint stale,
            // so clear it on the first keystroke rather than on the next save.
            onChangeText={(next) => {
              setName(next);
              setError(null);
            }}
            onSubmitEditing={onSave}
            placeholder={t('tags.namePlaceholder')}
            // Without this iOS capitalises the first letter, quietly turning
            // "birthday" into a second, separate "Birthday" tag.
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
          {error ? <CmpText className="text-sm text-destructive">{error}</CmpText> : null}
        </View>
        {/* The primitive stacks the buttons below the `sm` breakpoint, which no
            phone reaches, putting Save above Cancel. */}
        <CmpDialogFooter className="flex-row justify-end">
          <CmpButton variant="outline" disabled={busy} onPress={() => onOpenChange(false)}>
            <CmpText>{t('common.cancel')}</CmpText>
          </CmpButton>
          <CmpButton disabled={busy} onPress={onSave}>
            <CmpText>{busy ? t('common.working') : t('common.save')}</CmpText>
          </CmpButton>
        </CmpDialogFooter>
      </CmpDialogContent>
    </CmpDialog>
  );
}
