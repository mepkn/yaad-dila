import { CmpButton } from '@/components/cmp/cmp-button';
import { CmpCard, CmpCardContent, CmpCardHeader, CmpCardTitle } from '@/components/cmp/cmp-card';
import { CmpInput } from '@/components/cmp/cmp-input';
import { CmpLabel } from '@/components/cmp/cmp-label';
import { CmpText } from '@/components/cmp/cmp-text';
import { getStoredGeminiKey, setStoredGeminiKey } from '@/lib/gemini-key';
import { useAction } from '@/lib/use-action';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

export function VoiceAiSection() {
  const { t } = useTranslation();
  const [geminiKey, setGeminiKey] = React.useState('');

  React.useEffect(() => {
    let mounted = true;
    getStoredGeminiKey().then((stored) => {
      if (mounted && stored) setGeminiKey(stored);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // An empty field clears the stored key — see lib/secure-preference.ts.
  const save = useAction(() => setStoredGeminiKey(geminiKey.trim()), {
    success: t('settings.saved'),
  });

  return (
    <CmpCard className="w-full max-w-sm">
      <CmpCardHeader>
        <CmpCardTitle>{t('settings.sectionVoiceAi')}</CmpCardTitle>
      </CmpCardHeader>
      <CmpCardContent className="gap-4">
        <View className="gap-1.5">
          <CmpLabel nativeID="gemini_key">{t('settings.geminiKey')}</CmpLabel>
          <CmpInput
            aria-labelledby="gemini_key"
            value={geminiKey}
            onChangeText={setGeminiKey}
            autoCapitalize="none"
            secureTextEntry
            placeholder="AIza…"
          />
          <CmpText className="text-xs text-muted-foreground">{t('settings.geminiKeyHint')}</CmpText>
        </View>
        {save.status ? (
          <CmpText
            className={
              save.status.kind === 'ok' ? 'text-sm text-green-600' : 'text-sm text-destructive'
            }>
            {save.status.text}
          </CmpText>
        ) : null}
        <CmpButton variant="secondary" onPress={save.run}>
          <CmpText>{t('settings.saveGeminiKey')}</CmpText>
        </CmpButton>
      </CmpCardContent>
    </CmpCard>
  );
}
