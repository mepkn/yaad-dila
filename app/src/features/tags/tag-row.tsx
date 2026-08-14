import {
  CmpAlertDialog,
  CmpAlertDialogAction,
  CmpAlertDialogCancel,
  CmpAlertDialogContent,
  CmpAlertDialogDescription,
  CmpAlertDialogFooter,
  CmpAlertDialogHeader,
  CmpAlertDialogTitle,
  CmpAlertDialogTrigger,
} from '@/components/cmp/cmp-alert-dialog';
import { CmpBadge } from '@/components/cmp/cmp-badge';
import { CmpButton } from '@/components/cmp/cmp-button';
import { CmpCard, CmpCardContent } from '@/components/cmp/cmp-card';
import { CmpIcon } from '@/components/cmp/cmp-icon';
import { CmpText } from '@/components/cmp/cmp-text';
import type { TagWithCount } from '@/lib/tags';
import { PencilIcon, Trash2Icon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

export function TagRow({
  tag,
  onEdit,
  onDelete,
}: {
  tag: TagWithCount;
  onEdit: (tag: TagWithCount) => void;
  onDelete: (tag: TagWithCount) => void;
}) {
  const { t } = useTranslation();

  return (
    // The row itself is not pressable: renaming is the pencil button's job, so a
    // stray tap on the card does nothing.
    // Card defaults to py-6, which makes a one-line row look like a panel.
    <CmpCard className="py-3">
      <CmpCardContent className="flex-row items-center gap-2 px-4">
        <View className="flex-1 gap-1">
          <CmpText className="font-medium" numberOfLines={1}>
            {tag.name}
          </CmpText>
          <View className="flex-row">
            <CmpBadge variant="secondary">
              <CmpText className="text-xs">{t('tags.count', { count: tag.count })}</CmpText>
            </CmpBadge>
          </View>
        </View>
        <CmpButton
          variant="ghost"
          size="icon"
          accessibilityLabel={t('tags.edit', { name: tag.name })}
          onPress={() => onEdit(tag)}>
          <CmpIcon as={PencilIcon} className="size-5 text-muted-foreground" />
        </CmpButton>
        <CmpAlertDialog>
          <CmpAlertDialogTrigger asChild>
            <CmpButton
              variant="ghost"
              size="icon"
              accessibilityLabel={t('tags.deleteAction', { name: tag.name })}>
              <CmpIcon as={Trash2Icon} className="size-5 text-destructive" />
            </CmpButton>
          </CmpAlertDialogTrigger>
          <CmpAlertDialogContent>
            <CmpAlertDialogHeader>
              <CmpAlertDialogTitle>{t('tags.deleteTitle', { name: tag.name })}</CmpAlertDialogTitle>
              <CmpAlertDialogDescription>{t('tags.deleteBody')}</CmpAlertDialogDescription>
            </CmpAlertDialogHeader>
            <CmpAlertDialogFooter>
              <CmpAlertDialogCancel>
                <CmpText>{t('common.cancel')}</CmpText>
              </CmpAlertDialogCancel>
              <CmpAlertDialogAction onPress={() => onDelete(tag)}>
                <CmpText>{t('common.delete')}</CmpText>
              </CmpAlertDialogAction>
            </CmpAlertDialogFooter>
          </CmpAlertDialogContent>
        </CmpAlertDialog>
      </CmpCardContent>
    </CmpCard>
  );
}
