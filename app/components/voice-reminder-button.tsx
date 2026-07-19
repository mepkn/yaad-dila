import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { getStoredGeminiKey, parseReminderText, type ParsedReminder } from '@/lib/gemini';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { MicIcon } from 'lucide-react-native';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, View } from 'react-native';

type Phase = 'idle' | 'listening' | 'parsing';

export function VoiceReminderButton({
  onParsed,
}: {
  onParsed: (parsed: ParsedReminder) => void;
}) {
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

  return (
    <View className="items-center gap-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('ai.speakReminder')}
        onPress={onPress}
        className={`h-16 w-16 items-center justify-center rounded-full ${
          phase === 'listening' ? 'bg-destructive' : 'bg-primary'
        } active:opacity-80`}>
        {phase === 'parsing' ? (
          <ActivityIndicator color="white" />
        ) : (
          <Icon as={MicIcon} className="size-7 text-primary-foreground" />
        )}
      </Pressable>
      <Text className="text-xs text-muted-foreground">
        {phase === 'listening'
          ? transcript || t('ai.listening')
          : phase === 'parsing'
            ? t('ai.thinking')
            : t('ai.speakReminder')}
      </Text>
      {error ? <Text className="text-center text-sm text-destructive">{error}</Text> : null}
    </View>
  );
}
