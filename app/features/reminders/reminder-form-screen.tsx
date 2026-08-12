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
import { CmpButton } from '@/components/cmp/cmp-button';
import { CmpCard, CmpCardContent, CmpCardHeader, CmpCardTitle } from '@/components/cmp/cmp-card';
import {
  CmpCollapsible,
  CmpCollapsibleContent,
  CmpCollapsibleTrigger,
} from '@/components/cmp/cmp-collapsible';
import { CmpIcon } from '@/components/cmp/cmp-icon';
import { CmpInput } from '@/components/cmp/cmp-input';
import { CmpKeyboardAwareScrollView } from '@/components/cmp/cmp-keyboard-aware-scroll-view';
import { CmpLabel } from '@/components/cmp/cmp-label';
import {
  CmpSelect,
  CmpSelectContent,
  CmpSelectItem,
  CmpSelectTrigger,
  CmpSelectValue,
} from '@/components/cmp/cmp-select';
import { CmpText } from '@/components/cmp/cmp-text';
import { CmpTextarea } from '@/components/cmp/cmp-textarea';
import { useFabBottom, useFabContentPadding } from '@/features/reminders/fab-layout';
import { TagInput } from '@/features/reminders/tag-input';
import { describeError } from '@/lib/errors';
import { pb } from '@/lib/pb';
import {
  formatLocal,
  parseUTC,
  type IntervalUnit,
  type Reminder,
  type RepeatMode,
} from '@/lib/reminders';
import { markRemindersDirty } from '@/lib/reminders-dirty';
import { listTags, resolveTagIds, type SelectedTag, type Tag } from '@/lib/tags';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react-native';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';

import { VoiceReminderFab } from '@/features/reminders/voice-reminder-button';
import { type ParsedReminder } from '@/lib/gemini';

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

export function ReminderFormScreen() {
  const fabBottom = useFabBottom();
  const fabContentPadding = useFabContentPadding();
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
  const [note, setNote] = React.useState('');
  const [tags, setTags] = React.useState<SelectedTag[]>([]);
  const [allTags, setAllTags] = React.useState<Tag[]>([]);
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
  // Note / tags / priority are rarely touched, so the section starts closed. Editing an
  // existing reminder that already uses any of them opens it once, on load, so those
  // values are never hidden from the person who set them.
  const [moreOpen, setMoreOpen] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const records = await listTags();
        if (mounted) setAllTags(records);
      } catch {
        // Suggestions are optional; tag loading must not block the form.
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    if (isNew) return;
    let mounted = true;
    (async () => {
      try {
        const rec = await pb.collection('reminders').getOne<Reminder>(id, { expand: 'tags' });
        if (!mounted) return;
        setTitle(rec.title);
        setMessage(rec.message);
        const recNote = rec.note ?? '';
        const recTags = (rec.expand?.tags ?? []).map((tag) => ({ id: tag.id, name: tag.name }));
        const recPriority = String(rec.priority || 3);
        setNote(recNote);
        setTags(recTags);
        setPriority(recPriority);
        if (recNote.trim() || recTags.length > 0 || recPriority !== '3') setMoreOpen(true);
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
        onValueChange: (_event, date) => {
          DateTimePickerAndroid.open({
            value: date,
            mode: 'time',
            onValueChange: (_timeEvent, dateTime) => setStartAt(dateTime),
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
      const tagIds = await resolveTagIds(tags);
      const data: Record<string, unknown> = {
        user: pb.authStore.record?.id,
        title: title.trim(),
        message: message.trim(),
        note,
        tags: tagIds,
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
      markRemindersDirty();
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
      markRemindersDirty();
      router.back();
    } catch (err) {
      setError(describeError(err));
      setBusy(false);
    }
  }

  function onVoiceParsed(parsed: ParsedReminder) {
    setTitle(parsed.title);
    setMessage(parsed.message);
    setIntervalN(String(parsed.interval_n));
    setIntervalUnit(parsed.interval_unit);
    setRepeatMode(parsed.repeat_mode);
    if (parsed.repeat_count >= 1) setRepeatCount(String(parsed.repeat_count));
    setStartAt(parsed.start_at);
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
      <View className="flex-1">
        <CmpKeyboardAwareScrollView
          className="flex-1 bg-background"
          contentContainerClassName="items-center gap-4 p-4"
          // Both cases must clear the tab bar. Only the new-reminder screen
          // also carries the voice FAB, so only it reserves the FAB's height.
          contentContainerStyle={{
            paddingBottom: isNew ? fabContentPadding : fabBottom + 16,
          }}
          // The tag suggestion list is only ever visible while the keyboard is up; without
          // this the first tap on a suggestion is swallowed to dismiss the keyboard.
          keyboardShouldPersistTaps="handled"
          bottomOffset={16}>
          <CmpCard className="w-full max-w-sm">
            <CmpCardHeader>
              <CmpCardTitle>{t('reminder.sectionReminder')}</CmpCardTitle>
            </CmpCardHeader>
            <CmpCardContent className="gap-4">
              {lastError ? (
                <CmpText className="text-sm text-destructive">
                  {t('reminder.lastSendFailed', { error: lastError })}
                </CmpText>
              ) : null}
              <View className="gap-1.5">
                <CmpLabel nativeID="title">{t('reminder.titleLabel')}</CmpLabel>
                <CmpInput
                  aria-labelledby="title"
                  value={title}
                  onChangeText={setTitle}
                  placeholder={t('reminder.titlePlaceholder')}
                  editable={!loading}
                />
              </View>
              <View className="gap-1.5">
                <CmpLabel nativeID="message">{t('reminder.messageLabel')}</CmpLabel>
                <CmpTextarea
                  aria-labelledby="message"
                  value={message}
                  onChangeText={setMessage}
                  placeholder={t('reminder.messagePlaceholder')}
                  editable={!loading}
                />
              </View>
            </CmpCardContent>
          </CmpCard>

          <CmpCard className="w-full max-w-sm">
            <CmpCardHeader>
              <CmpCardTitle>{t('reminder.sectionSchedule')}</CmpCardTitle>
            </CmpCardHeader>
            <CmpCardContent className="gap-4">
              <View className="gap-1.5">
                <CmpLabel>{t('reminder.starts')}</CmpLabel>
                <CmpButton variant="outline" onPress={onPickStartAt} disabled={loading}>
                  <CmpText>{formatLocal(startAt.toISOString())}</CmpText>
                </CmpButton>
                {showIosPicker && Platform.OS === 'ios' ? (
                  <DateTimePicker
                    value={startAt}
                    mode="datetime"
                    display="spinner"
                    onValueChange={(_event, date) => setStartAt(date)}
                  />
                ) : null}
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1 gap-1.5">
                  <CmpLabel nativeID="interval_n">{t('reminder.every')}</CmpLabel>
                  <CmpInput
                    aria-labelledby="interval_n"
                    value={intervalN}
                    onChangeText={setIntervalN}
                    keyboardType="number-pad"
                    editable={!loading}
                  />
                </View>
                <View className="flex-[2] gap-1.5">
                  <CmpLabel nativeID="interval_unit">{t('reminder.unit')}</CmpLabel>
                  <CmpSelect
                    value={unitOptions.find((o) => o.value === intervalUnit)}
                    onValueChange={(option) => {
                      if (option) setIntervalUnit(option.value as IntervalUnit);
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
                  value={repeatOptions.find((o) => o.value === repeatMode)}
                  onValueChange={(option) => {
                    if (option) setRepeatMode(option.value as RepeatMode);
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
              {repeatMode === 'count' ? (
                <View className="gap-1.5">
                  <CmpLabel nativeID="repeat_count">{t('reminder.totalFires')}</CmpLabel>
                  <CmpInput
                    aria-labelledby="repeat_count"
                    value={repeatCount}
                    onChangeText={setRepeatCount}
                    keyboardType="number-pad"
                    editable={!loading}
                  />
                </View>
              ) : null}
            </CmpCardContent>
          </CmpCard>

          <CmpCollapsible className="w-full max-w-sm" open={moreOpen} onOpenChange={setMoreOpen}>
            <CmpCard className="w-full">
              {/* The trigger renders its own Pressable and stands in for CmpCardHeader —
                  slotting it onto the header instead would drop onPress, since the header
                  is a plain View. Hence the header's px-6 repeated here. */}
              <CmpCollapsibleTrigger className="flex-row items-center gap-2 px-6">
                {/* flex-1 on the title, shrink-0 on the icon: without it the row squeezes a
                    longer translation (Hindi "और विकल्प") down to its first word. */}
                <CmpCardTitle className="flex-1">{t('reminder.sectionMore')}</CmpCardTitle>
                {/* Swapping the glyph rather than rotating one: NativeWind's rotate-180
                    makes the icon vanish here instead of flipping it. */}
                <CmpIcon
                  as={moreOpen ? ChevronUpIcon : ChevronDownIcon}
                  className="size-5 shrink-0 text-muted-foreground"
                />
              </CmpCollapsibleTrigger>
              <CmpCollapsibleContent>
                <CmpCardContent className="gap-4">
                  <View className="gap-1.5">
                    <CmpLabel nativeID="note">{t('reminder.noteLabel')}</CmpLabel>
                    <CmpTextarea
                      aria-labelledby="note"
                      value={note}
                      onChangeText={setNote}
                      placeholder={t('reminder.notePlaceholder')}
                      editable={!loading}
                    />
                  </View>
                  <View className="gap-1.5">
                    <CmpLabel nativeID="tags">{t('reminder.tagsLabel')}</CmpLabel>
                    <TagInput
                      value={tags}
                      onChange={setTags}
                      available={allTags}
                      placeholder={t('reminder.tagsPlaceholder')}
                      editable={!loading}
                    />
                  </View>
                  <View className="gap-1.5">
                    <CmpLabel nativeID="priority">{t('reminder.priority')}</CmpLabel>
                    <CmpSelect
                      value={priorityOptions.find((o) => o.value === priority)}
                      onValueChange={(option) => {
                        if (option) setPriority(option.value);
                      }}>
                      <CmpSelectTrigger aria-labelledby="priority">
                        <CmpSelectValue placeholder={t('reminder.priority')} />
                      </CmpSelectTrigger>
                      <CmpSelectContent>
                        {priorityOptions.map((o) => (
                          <CmpSelectItem key={o.value} value={o.value} label={o.label} />
                        ))}
                      </CmpSelectContent>
                    </CmpSelect>
                  </View>
                </CmpCardContent>
              </CmpCollapsibleContent>
            </CmpCard>
          </CmpCollapsible>

          <View className="w-full max-w-sm gap-4">
            {error ? <CmpText className="text-sm text-destructive">{error}</CmpText> : null}
            <CmpButton onPress={onSave} disabled={!canSave}>
              <CmpText>
                {busy ? t('common.working') : isNew ? t('reminder.create') : t('common.save')}
              </CmpText>
            </CmpButton>
            {!isNew ? (
              <CmpAlertDialog>
                <CmpAlertDialogTrigger asChild>
                  <CmpButton variant="destructive" disabled={busy || loading}>
                    <CmpText>{t('common.delete')}</CmpText>
                  </CmpButton>
                </CmpAlertDialogTrigger>
                <CmpAlertDialogContent>
                  <CmpAlertDialogHeader>
                    <CmpAlertDialogTitle>{t('reminder.deleteTitle')}</CmpAlertDialogTitle>
                    <CmpAlertDialogDescription>
                      {t('reminder.deleteBody', { title })}
                    </CmpAlertDialogDescription>
                  </CmpAlertDialogHeader>
                  <CmpAlertDialogFooter>
                    <CmpAlertDialogCancel>
                      <CmpText>{t('common.cancel')}</CmpText>
                    </CmpAlertDialogCancel>
                    <CmpAlertDialogAction onPress={onDelete}>
                      <CmpText>{t('common.delete')}</CmpText>
                    </CmpAlertDialogAction>
                  </CmpAlertDialogFooter>
                </CmpAlertDialogContent>
              </CmpAlertDialog>
            ) : null}
          </View>
        </CmpKeyboardAwareScrollView>
        {isNew ? <VoiceReminderFab onParsed={onVoiceParsed} /> : null}
      </View>
    </>
  );
}
