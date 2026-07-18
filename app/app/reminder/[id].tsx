import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { describeError } from '@/lib/errors';
import { pb } from '@/lib/pb';
import {
  formatLocal,
  parseUTC,
  type IntervalUnit,
  type Reminder,
  type RepeatMode,
} from '@/lib/reminders';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardAwareScrollView } from '@/components/keyboard-aware-scroll-view';

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

const PRIORITY_VALUES = ['1', '2', '3', '4', '5'] as const;

export default function ReminderFormScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const unitOptions = (Object.keys(UNIT_LABEL_KEYS) as IntervalUnit[]).map((value) => ({
    value,
    label: t(UNIT_LABEL_KEYS[value]),
  }));
  const repeatOptions = (Object.keys(REPEAT_LABEL_KEYS) as RepeatMode[]).map((value) => ({
    value,
    label: t(REPEAT_LABEL_KEYS[value]),
  }));
  const priorityOptions = PRIORITY_VALUES.map((value) => ({
    value,
    label: t(`reminder.priority${value}`),
  }));
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const router = useRouter();

  const [title, setTitle] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [priority, setPriority] = React.useState('3');
  const [intervalN, setIntervalN] = React.useState('1');
  const [intervalUnit, setIntervalUnit] = React.useState<IntervalUnit>('days');
  const [repeatMode, setRepeatMode] = React.useState<RepeatMode>('once');
  const [repeatCount, setRepeatCount] = React.useState('2');
  const [startAt, setStartAt] = React.useState<Date>(() => new Date());
  const [showIosPicker, setShowIosPicker] = React.useState(false);
  const [lastError, setLastError] = React.useState('');
  const [loading, setLoading] = React.useState(!isNew);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isNew) return;
    let mounted = true;
    (async () => {
      try {
        const rec = await pb.collection('reminders').getOne<Reminder>(id);
        if (!mounted) return;
        setTitle(rec.title);
        setMessage(rec.message);
        setPriority(String(rec.priority || 3));
        setIntervalN(String(rec.interval_n));
        setIntervalUnit(rec.interval_unit);
        setRepeatMode(rec.repeat_mode);
        if (rec.repeat_count >= 1) setRepeatCount(String(rec.repeat_count));
        setStartAt(parseUTC(rec.start_at));
        setLastError(rec.last_error ?? '');
      } catch (err) {
        if (mounted) setError(describeError(err));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id, isNew]);

  // Android has no combined datetime mode — chain a date picker into a time picker.
  function onPickStartAt() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: startAt,
        mode: 'date',
        onChange: (event: DateTimePickerEvent, date?: Date) => {
          if (event.type !== 'set' || !date) return;
          DateTimePickerAndroid.open({
            value: date,
            mode: 'time',
            onChange: (timeEvent: DateTimePickerEvent, dateTime?: Date) => {
              if (timeEvent.type === 'set' && dateTime) setStartAt(dateTime);
            },
          });
        },
      });
    } else {
      setShowIosPicker((v) => !v);
    }
  }

  async function onSave() {
    setBusy(true);
    setError(null);
    try {
      const data: Record<string, unknown> = {
        user: pb.authStore.record?.id,
        title: title.trim(),
        message: message.trim(),
        priority: Number(priority),
        interval_n: Number(intervalN),
        interval_unit: intervalUnit,
        repeat_mode: repeatMode,
        repeat_count: repeatMode === 'count' ? Number(repeatCount) : 0,
        // Local Date → UTC ISO string. The backend computes next_fire.
        start_at: startAt.toISOString(),
      };
      if (isNew) {
        await pb.collection('reminders').create(data);
      } else {
        await pb.collection('reminders').update(id, data);
      }
      router.back();
    } catch (err) {
      setError(describeError(err));
      setBusy(false);
    }
  }

  async function onDelete() {
    setBusy(true);
    setError(null);
    try {
      await pb.collection('reminders').delete(id);
      router.back();
    } catch (err) {
      setError(describeError(err));
      setBusy(false);
    }
  }

  const canSave =
    !loading &&
    !busy &&
    title.trim().length > 0 &&
    message.trim().length > 0 &&
    Number(intervalN) >= 1 &&
    (repeatMode !== 'count' || Number(repeatCount) >= 1);

  return (
    <>
      <Stack.Screen options={{ title: isNew ? t('reminder.newTitle') : t('reminder.editTitle') }} />
      <KeyboardAwareScrollView
        className="flex-1 bg-background"
        contentContainerClassName="items-center p-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        bottomOffset={16}
        keyboardShouldPersistTaps="handled">
          <Card className="w-full max-w-sm">
            <CardContent className="gap-4">
              {lastError ? (
                <Text className="text-sm text-destructive">{t('reminder.lastSendFailed', { error: lastError })}</Text>
              ) : null}
              <View className="gap-1.5">
                <Label nativeID="title">{t('reminder.titleLabel')}</Label>
                <Input
                  aria-labelledby="title"
                  value={title}
                  onChangeText={setTitle}
                  placeholder={t('reminder.titlePlaceholder')}
                  editable={!loading}
                />
              </View>
              <View className="gap-1.5">
                <Label nativeID="message">{t('reminder.messageLabel')}</Label>
                <Textarea
                  aria-labelledby="message"
                  value={message}
                  onChangeText={setMessage}
                  placeholder={t('reminder.messagePlaceholder')}
                  editable={!loading}
                />
              </View>
              <View className="gap-1.5">
                <Label>{t('reminder.starts')}</Label>
                <Button variant="outline" onPress={onPickStartAt} disabled={loading}>
                  <Text>{formatLocal(startAt.toISOString())}</Text>
                </Button>
                {showIosPicker && Platform.OS === 'ios' ? (
                  <DateTimePicker
                    value={startAt}
                    mode="datetime"
                    display="spinner"
                    onChange={(event: DateTimePickerEvent, date?: Date) => {
                      if (date) setStartAt(date);
                    }}
                  />
                ) : null}
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1 gap-1.5">
                  <Label nativeID="interval_n">{t('reminder.every')}</Label>
                  <Input
                    aria-labelledby="interval_n"
                    value={intervalN}
                    onChangeText={setIntervalN}
                    keyboardType="number-pad"
                    editable={!loading}
                  />
                </View>
                <View className="flex-[2] gap-1.5">
                  <Label nativeID="interval_unit">{t('reminder.unit')}</Label>
                  <Select
                    value={unitOptions.find((o) => o.value === intervalUnit)}
                    onValueChange={(option) => {
                      if (option) setIntervalUnit(option.value as IntervalUnit);
                    }}>
                    <SelectTrigger aria-labelledby="interval_unit">
                      <SelectValue placeholder={t('reminder.unit')} />
                    </SelectTrigger>
                    <SelectContent>
                      {unitOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value} label={o.label} />
                      ))}
                    </SelectContent>
                  </Select>
                </View>
              </View>
              <View className="gap-1.5">
                <Label nativeID="repeat_mode">{t('reminder.repeat')}</Label>
                <Select
                  value={repeatOptions.find((o) => o.value === repeatMode)}
                  onValueChange={(option) => {
                    if (option) setRepeatMode(option.value as RepeatMode);
                  }}>
                  <SelectTrigger aria-labelledby="repeat_mode">
                    <SelectValue placeholder={t('reminder.repeat')} />
                  </SelectTrigger>
                  <SelectContent>
                    {repeatOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value} label={o.label} />
                    ))}
                  </SelectContent>
                </Select>
              </View>
              {repeatMode === 'count' ? (
                <View className="gap-1.5">
                  <Label nativeID="repeat_count">{t('reminder.totalFires')}</Label>
                  <Input
                    aria-labelledby="repeat_count"
                    value={repeatCount}
                    onChangeText={setRepeatCount}
                    keyboardType="number-pad"
                    editable={!loading}
                  />
                </View>
              ) : null}
              <View className="gap-1.5">
                <Label nativeID="priority">{t('reminder.priority')}</Label>
                <Select
                  value={priorityOptions.find((o) => o.value === priority)}
                  onValueChange={(option) => {
                    if (option) setPriority(option.value);
                  }}>
                  <SelectTrigger aria-labelledby="priority">
                    <SelectValue placeholder={t('reminder.priority')} />
                  </SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value} label={o.label} />
                    ))}
                  </SelectContent>
                </Select>
              </View>
              {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
              <Button onPress={onSave} disabled={!canSave}>
                <Text>{busy ? t('common.working') : isNew ? t('reminder.create') : t('common.save')}</Text>
              </Button>
              {!isNew ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={busy || loading}>
                      <Text>{t('common.delete')}</Text>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('reminder.deleteTitle')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('reminder.deleteBody', { title })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>
                        <Text>{t('common.cancel')}</Text>
                      </AlertDialogCancel>
                      <AlertDialogAction onPress={onDelete}>
                        <Text>{t('common.delete')}</Text>
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
            </CardContent>
          </Card>
      </KeyboardAwareScrollView>
    </>
  );
}
