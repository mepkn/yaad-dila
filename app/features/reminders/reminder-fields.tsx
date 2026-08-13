import { CmpCard, CmpCardContent, CmpCardHeader, CmpCardTitle } from '@/components/cmp/cmp-card';
import { CmpInput } from '@/components/cmp/cmp-input';
import { CmpLabel } from '@/components/cmp/cmp-label';
import { CmpText } from '@/components/cmp/cmp-text';
import { CmpTextarea } from '@/components/cmp/cmp-textarea';
import { formatLocal, type ReminderDraft } from '@/lib/reminders';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import type { DraftUpdate } from '@/features/reminders/draft-update';

interface ReminderFieldsProps {
  draft: ReminderDraft;
  update: DraftUpdate;
  editable: boolean;
  /** Empty until the cron tick has attempted this reminder at least once. */
  lastFired: string;
  lastError: string;
}

export function ReminderFields({
  draft,
  update,
  editable,
  lastFired,
  lastError,
}: ReminderFieldsProps) {
  const { t } = useTranslation();

  return (
    <CmpCard className="w-full max-w-sm">
      <CmpCardHeader>
        <CmpCardTitle>{t('reminder.sectionReminder')}</CmpCardTitle>
      </CmpCardHeader>
      <CmpCardContent className="gap-4">
        {lastFired ? (
          <CmpText
            className={lastError ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
            {lastError
              ? t('reminder.lastFailedAt', { date: formatLocal(lastFired) })
              : t('reminder.lastSentAt', { date: formatLocal(lastFired) })}
          </CmpText>
        ) : null}
        {lastError ? (
          <CmpText className="text-sm text-destructive">
            {t('reminder.lastSendFailed', { error: lastError })}
          </CmpText>
        ) : null}
        <View className="gap-1.5">
          <CmpLabel nativeID="title">{t('reminder.titleLabel')}</CmpLabel>
          <CmpInput
            aria-labelledby="title"
            value={draft.title}
            onChangeText={(v) => update('title', v)}
            placeholder={t('reminder.titlePlaceholder')}
            editable={editable}
          />
        </View>
        <View className="gap-1.5">
          <CmpLabel nativeID="message">{t('reminder.messageLabel')}</CmpLabel>
          <CmpTextarea
            aria-labelledby="message"
            value={draft.message}
            onChangeText={(v) => update('message', v)}
            placeholder={t('reminder.messagePlaceholder')}
            editable={editable}
          />
        </View>
      </CmpCardContent>
    </CmpCard>
  );
}
