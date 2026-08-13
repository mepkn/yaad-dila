import { CmpButton } from '@/components/cmp/cmp-button';
import { CmpIcon } from '@/components/cmp/cmp-icon';
import { CmpText } from '@/components/cmp/cmp-text';
import { useFabBottom } from '@/features/reminders/fab-layout';
import { getStoredGeminiKey } from '@/lib/gemini-key';
import { parseReminderText, type ParsedReminder } from '@/lib/gemini';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { MicIcon } from 'lucide-react-native';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

type Phase = 'idle' | 'listening' | 'parsing';

export function VoiceReminderFab({ onParsed }: { onParsed: (parsed: ParsedReminder) => void }) {
  const fabBottom = useFabBottom();
  const { t, i18n } = useTranslation();
  const [phase, setPhase] = React.useState<Phase>('idle');
  const [transcript, setTranscript] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const transcriptRef = React.useRef('');
  const phaseRef = React.useRef<Phase>('idle');
  phaseRef.current = phase;

  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results[0]?.transcript ?? '';
    transcriptRef.current = text;
    setTranscript(text);
  });

  useSpeechRecognitionEvent('end', () => {
    if (phaseRef.current !== 'listening') return;
    const text = transcriptRef.current.trim();
    if (!text) {
      setPhase('idle');
      setError(t('ai.nothingHeard'));
      return;
    }
    void parse(text);
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (phaseRef.current !== 'listening') return;
    setPhase('idle');
    setError(event.error === 'no-speech' ? t('ai.nothingHeard') : event.message || event.error);
  });

  async function parse(text: string) {
    setPhase('parsing');
    setError(null);
    try {
      const key = await getStoredGeminiKey();
      if (!key) {
        setError(t('ai.noKey'));
        return;
      }
      const parsed = await parseReminderText(text, key);
      onParsed(parsed);
      setTranscript('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPhase('idle');
    }
  }

  async function onPress() {
    setError(null);
    if (phase === 'listening') {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    if (phase === 'parsing') return;
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      setError(t('ai.micDenied'));
      return;
    }
    transcriptRef.current = '';
    setTranscript('');
    setPhase('listening');
    ExpoSpeechRecognitionModule.start({
      lang: i18n.language === 'hi' ? 'hi-IN' : 'en-IN',
      interimResults: true,
    });
  }

  const showPill = phase !== 'idle' || !!error;

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-0 bottom-0 items-end px-6"
      // Shares its offset with the home FAB so the button does not jump between
      // screens, and clears the tab bar — see fab-layout.ts.
      style={{ paddingBottom: fabBottom }}>
      {showPill ? (
        <View className="mb-3 w-full rounded-xl border border-border bg-card p-3 shadow-sm">
          {error ? (
            <CmpText className="text-sm text-destructive">{error}</CmpText>
          ) : (
            <CmpText className="text-sm text-foreground">
              {phase === 'listening' ? transcript || t('ai.listening') : t('ai.thinking')}
            </CmpText>
          )}
        </View>
      ) : null}
      <CmpButton
        size="icon"
        className="h-14 w-14 rounded-full"
        variant={phase === 'listening' ? 'destructive' : 'default'}
        onPress={onPress}
        accessibilityLabel={t('ai.speakReminder')}>
        {phase === 'parsing' ? (
          <ActivityIndicator color="white" />
        ) : (
          <CmpIcon as={MicIcon} className="size-6 text-primary-foreground" />
        )}
      </CmpButton>
    </View>
  );
}
