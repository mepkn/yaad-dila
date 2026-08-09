import { CmpBadge } from '@/components/cmp/cmp-badge';
import { CmpCard, CmpCardContent, CmpCardHeader, CmpCardTitle } from '@/components/cmp/cmp-card';
import { CmpSwitch } from '@/components/cmp/cmp-switch';
import { CmpText } from '@/components/cmp/cmp-text';
import { formatLocal, isFinished, type Reminder } from '@/lib/reminders';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

export function ReminderCard({
  reminder,
  onToggleActive,
}: {
  reminder: Reminder;
  onToggleActive: (reminder: Reminder, active: boolean) => void;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const finished = isFinished(reminder);
  return (
    <Pressable onPress={() => router.push(`/reminder/${reminder.id}`)}>
      <CmpCard>
        <CmpCardHeader className="flex-row items-center justify-between gap-3">
          <CmpCardTitle className="flex-1" numberOfLines={1}>
            {reminder.title}
          </CmpCardTitle>
          {finished ? (
            <CmpBadge variant="secondary">
              <CmpText>{t('reminders.finished')}</CmpText>
            </CmpBadge>
          ) : (
            <CmpSwitch
              checked={reminder.active}
              onCheckedChange={(checked) => onToggleActive(reminder, checked)}
            />
          )}
        </CmpCardHeader>
        <CmpCardContent className="gap-1">
          <CmpText className="text-sm text-muted-foreground">
            {finished
              ? t('reminders.doneFired', { count: reminder.fired_count })
              : reminder.active
                ? t('reminders.next', { date: formatLocal(reminder.next_fire) })
                : t('reminders.paused')}
          </CmpText>
          {reminder.last_error ? (
            <CmpText className="text-sm text-destructive" numberOfLines={2}>
              {t('reminders.lastSendFailed', { error: reminder.last_error })}
            </CmpText>
          ) : null}
          {reminder.expand?.tags?.length ? (
            <View className="flex-row flex-wrap gap-1.5">
              {reminder.expand.tags.map((tag) => (
                <CmpBadge key={tag.id} variant="secondary">
                  <CmpText className="text-xs">{tag.name}</CmpText>
                </CmpBadge>
              ))}
            </View>
          ) : null}
        </CmpCardContent>
      </CmpCard>
    </Pressable>
  );
}
