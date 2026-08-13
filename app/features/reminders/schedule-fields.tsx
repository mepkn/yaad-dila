import { CmpButton } from '@/components/cmp/cmp-button';
import { CmpCard, CmpCardContent, CmpCardHeader, CmpCardTitle } from '@/components/cmp/cmp-card';
import { CmpInput } from '@/components/cmp/cmp-input';
import { CmpLabel } from '@/components/cmp/cmp-label';
import {
  CmpSelect,
  CmpSelectContent,
  CmpSelectItem,
  CmpSelectTrigger,
  CmpSelectValue,
} from '@/components/cmp/cmp-select';
import { CmpText } from '@/components/cmp/cmp-text';
import type { DraftUpdate } from '@/features/reminders/draft-update';
import {
  formatLocal,
  type IntervalUnit,
  type ReminderDraft,
  type RepeatMode,
} from '@/lib/reminders';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';

const UNIT_LABEL_KEYS: Record<IntervalUnit, string> = {
  minutes: 'reminder.unitMinutes',
  hours: 'reminder.unitHours',
  days: 'reminder.unitDays',
  weeks: 'reminder.unitWeeks',
  months: 'reminder.unitMonths',
};

const REPEAT_LABEL_KEYS: Record<RepeatMode, string> = {
  once: 'reminder.repeatOnce',
  forever: 'reminder.repeatForever',
  count: 'reminder.repeatCount',
};

interface ScheduleFieldsProps {
  draft: ReminderDraft;
  update: DraftUpdate;
  editable: boolean;
}

export function ScheduleFields({ draft, update, editable }: ScheduleFieldsProps) {
  const { t } = useTranslation();
  // Only this card shows a picker, so its visibility never leaves this file.
  const [showIosPicker, setShowIosPicker] = React.useState(false);

  const unitOptions = (Object.keys(UNIT_LABEL_KEYS) as IntervalUnit[]).map((value) => ({
    value,
    label: t(UNIT_LABEL_KEYS[value]),
  }));
  const repeatOptions = (Object.keys(REPEAT_LABEL_KEYS) as RepeatMode[]).map((value) => ({
    value,
    label: t(REPEAT_LABEL_KEYS[value]),
  }));

  // Android has no combined datetime mode — chain a date picker into a time picker.
  function onPickStartAt() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: draft.start_at,
        mode: 'date',
        onValueChange: (_event, date) => {
          DateTimePickerAndroid.open({
            value: date,
            mode: 'time',
            onValueChange: (_timeEvent, dateTime) => update('start_at', dateTime),
          });
        },
      });
    } else {
      setShowIosPicker((v) => !v);
    }
  }

  return (
    <CmpCard className="w-full max-w-sm">
      <CmpCardHeader>
        <CmpCardTitle>{t('reminder.sectionSchedule')}</CmpCardTitle>
      </CmpCardHeader>
      <CmpCardContent className="gap-4">
        <View className="gap-1.5">
          <CmpLabel>{t('reminder.starts')}</CmpLabel>
          <CmpButton variant="outline" onPress={onPickStartAt} disabled={!editable}>
            <CmpText>{formatLocal(draft.start_at.toISOString())}</CmpText>
          </CmpButton>
          {showIosPicker && Platform.OS === 'ios' ? (
            <DateTimePicker
              value={draft.start_at}
              mode="datetime"
              display="spinner"
              onValueChange={(_event, date) => update('start_at', date)}
            />
          ) : null}
        </View>
        <View className="flex-row gap-3">
          <View className="flex-1 gap-1.5">
            <CmpLabel nativeID="interval_n">{t('reminder.every')}</CmpLabel>
            <CmpInput
              aria-labelledby="interval_n"
              value={draft.interval_n}
              onChangeText={(v) => update('interval_n', v)}
              keyboardType="number-pad"
              editable={editable}
            />
          </View>
          <View className="flex-[2] gap-1.5">
            <CmpLabel nativeID="interval_unit">{t('reminder.unit')}</CmpLabel>
            <CmpSelect
              value={unitOptions.find((o) => o.value === draft.interval_unit)}
              onValueChange={(option) => {
                if (option) update('interval_unit', option.value as IntervalUnit);
              }}>
              <CmpSelectTrigger aria-labelledby="interval_unit">
                <CmpSelectValue placeholder={t('reminder.unit')} />
              </CmpSelectTrigger>
              <CmpSelectContent>
                {unitOptions.map((o) => (
                  <CmpSelectItem key={o.value} value={o.value} label={o.label} />
                ))}
              </CmpSelectContent>
            </CmpSelect>
          </View>
        </View>
        <View className="gap-1.5">
          <CmpLabel nativeID="repeat_mode">{t('reminder.repeat')}</CmpLabel>
          <CmpSelect
            value={repeatOptions.find((o) => o.value === draft.repeat_mode)}
            onValueChange={(option) => {
              if (option) update('repeat_mode', option.value as RepeatMode);
            }}>
            <CmpSelectTrigger aria-labelledby="repeat_mode">
              <CmpSelectValue placeholder={t('reminder.repeat')} />
            </CmpSelectTrigger>
            <CmpSelectContent>
              {repeatOptions.map((o) => (
                <CmpSelectItem key={o.value} value={o.value} label={o.label} />
              ))}
            </CmpSelectContent>
          </CmpSelect>
        </View>
        {draft.repeat_mode === 'count' ? (
          <View className="gap-1.5">
            <CmpLabel nativeID="repeat_count">{t('reminder.totalFires')}</CmpLabel>
            <CmpInput
              aria-labelledby="repeat_count"
              value={draft.repeat_count}
              onChangeText={(v) => update('repeat_count', v)}
              keyboardType="number-pad"
              editable={editable}
            />
          </View>
        ) : null}
      </CmpCardContent>
    </CmpCard>
  );
}
