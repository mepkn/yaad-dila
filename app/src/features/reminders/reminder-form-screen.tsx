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
import { CmpKeyboardAwareScrollView } from '@/components/cmp/cmp-keyboard-aware-scroll-view';
import { CmpText } from '@/components/cmp/cmp-text';
import { useFabBottom, useFabContentPadding } from '@/features/reminders/fab-layout';
import { MoreOptionsFields } from '@/features/reminders/more-options-fields';
import { ReminderFields } from '@/features/reminders/reminder-fields';
import { ScheduleFields } from '@/features/reminders/schedule-fields';
import { VoiceReminderFab } from '@/features/reminders/voice-reminder-button';
import { describeError } from '@/lib/errors';
import { type ParsedReminder } from '@/lib/gemini';
import {
  deleteReminder,
  draftFromParsed,
  draftFromRecord,
  emptyDraft,
  getReminder,
  isDraftValid,
  saveReminder,
  type ReminderDraft,
} from '@/lib/reminders';
import { useAction } from '@/lib/use-action';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

/**
 * Owns the draft and the two actions; the three cards render it.
 *
 * The cards are presentational — they receive the draft and the one updater and
 * hold only the state nobody else needs (the iOS picker's visibility, the tag
 * suggestions). Nothing but `draft` and `update` crosses between them.
 */
export function ReminderFormScreen() {
  const fabBottom = useFabBottom();
  const fabContentPadding = useFabContentPadding();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const router = useRouter();

  const [draft, setDraft] = React.useState<ReminderDraft>(emptyDraft);
  const [lastError, setLastError] = React.useState('');
  const [lastFired, setLastFired] = React.useState('');
  const [loading, setLoading] = React.useState(!isNew);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  // Note / tags / priority are rarely touched, so the section starts closed. Editing an
  // existing reminder that already uses any of them opens it once, on load, so those
  // values are never hidden from the person who set them.
  const [moreOpen, setMoreOpen] = React.useState(false);

  // One updater for every input: no field gets its own setter to forget.
  const update = React.useCallback(
    <K extends keyof ReminderDraft>(key: K, value: ReminderDraft[K]) => {
      setDraft((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  React.useEffect(() => {
    if (isNew) return;
    let mounted = true;
    (async () => {
      try {
        const rec = await getReminder(id);
        if (!mounted) return;
        const loaded = draftFromRecord(rec);
        setDraft(loaded);
        if (loaded.note.trim() || loaded.tags.length > 0 || loaded.priority !== '3') {
          setMoreOpen(true);
        }
        setLastError(rec.last_error ?? '');
        setLastFired(rec.last_fired ?? '');
      } catch (err) {
        if (mounted) setLoadError(describeError(err));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id, isNew]);

  // Both navigate away on success, so both stay busy: releasing the button
  // during the transition invites a second press on work already done.
  const save = useAction(
    async () => {
      await saveReminder(draft, isNew ? undefined : id);
      router.back();
    },
    { keepBusyOnSuccess: true }
  );

  const remove = useAction(
    async () => {
      await deleteReminder(id);
      router.back();
    },
    { keepBusyOnSuccess: true }
  );

  const busy = save.busy || remove.busy;
  const error = loadError ?? save.status?.text ?? remove.status?.text ?? null;

  function onVoiceParsed(parsed: ParsedReminder) {
    setDraft((prev) => draftFromParsed(prev, parsed));
  }

  const canSave = !loading && !busy && isDraftValid(draft);

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
          <ReminderFields
            draft={draft}
            update={update}
            editable={!loading}
            lastFired={lastFired}
            lastError={lastError}
          />
          <ScheduleFields draft={draft} update={update} editable={!loading} />
          <MoreOptionsFields
            draft={draft}
            update={update}
            editable={!loading}
            open={moreOpen}
            onOpenChange={setMoreOpen}
          />

          <View className="w-full max-w-sm gap-4">
            {error ? <CmpText className="text-sm text-destructive">{error}</CmpText> : null}
            <CmpButton onPress={save.run} disabled={!canSave}>
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
                      {t('reminder.deleteBody', { title: draft.title })}
                    </CmpAlertDialogDescription>
                  </CmpAlertDialogHeader>
                  <CmpAlertDialogFooter>
                    <CmpAlertDialogCancel>
                      <CmpText>{t('common.cancel')}</CmpText>
                    </CmpAlertDialogCancel>
                    <CmpAlertDialogAction onPress={remove.run}>
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
