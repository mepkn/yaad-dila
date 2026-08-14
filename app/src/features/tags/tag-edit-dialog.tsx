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
import { saveTag } from '@/lib/tags';
import type { TagWithCount } from '@/lib/tags';
import { useAction } from '@/lib/use-action';
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
  // A rejected name, in this dialog's words. Real failures — no network, a
  // stale token — are reported by the action's own status instead.
  const [rejected, setRejected] = React.useState<string | null>(null);

  const save = useAction(async () => {
    setRejected(null);
    const outcome = await saveTag(name, tag?.id);
    if (outcome === 'empty') return setRejected(t('tags.nameRequired'));
    if (outcome === 'duplicate') return setRejected(t('tags.duplicate'));
    onOpenChange(false);
    onSaved();
  });

  // Reset on every open rather than on mount: the dialog stays mounted between
  // uses, so a stale name from the previous tag would otherwise leak in.
  React.useEffect(() => {
    if (open) {
      setName(tag?.name ?? '');
      setRejected(null);
      save.clear();
    }
    // save.clear is stable; re-running on it would fight the reset above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tag]);

  const error = rejected ?? save.status?.text ?? null;

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
              setRejected(null);
            }}
            onSubmitEditing={save.run}
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
          <CmpButton variant="outline" disabled={save.busy} onPress={() => onOpenChange(false)}>
            <CmpText>{t('common.cancel')}</CmpText>
          </CmpButton>
          <CmpButton disabled={save.busy} onPress={save.run}>
            <CmpText>{save.busy ? t('common.working') : t('common.save')}</CmpText>
          </CmpButton>
        </CmpDialogFooter>
      </CmpDialogContent>
    </CmpDialog>
  );
}
