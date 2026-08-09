import { CmpButton } from '@/components/cmp/cmp-button';
import { CmpCard, CmpCardContent } from '@/components/cmp/cmp-card';
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
import { describeError } from '@/lib/errors';
import { pb } from '@/lib/pb';
import { sendTestNotification, type NtfyAuthType } from '@/lib/ntfy';
import { getStoredGeminiKey, setStoredGeminiKey } from '@/lib/gemini';
import { LANGUAGE_OPTIONS, setAppLanguage } from '@/lib/i18n';
import { type AppLanguage } from '@/lib/locale-preference';
import { Stack } from 'expo-router';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const AUTH_VALUES: NtfyAuthType[] = ['none', 'token', 'basic'];

const AUTH_LABEL_KEYS: Record<NtfyAuthType, string> = {
  none: 'settings.authNone',
  token: 'settings.authToken',
  basic: 'settings.authBasic',
};

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const authOptions = AUTH_VALUES.map((value) => ({ value, label: t(AUTH_LABEL_KEYS[value]) }));
  const [recordId, setRecordId] = React.useState<string | null>(null);
  const [baseUrl, setBaseUrl] = React.useState('');
  const [topic, setTopic] = React.useState('');
  const [authType, setAuthType] = React.useState<NtfyAuthType>('none');
  const [token, setToken] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [geminiKey, setGeminiKey] = React.useState('');
  const [geminiStatus, setGeminiStatus] = React.useState<{
    kind: 'ok' | 'error';
    text: string;
  } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  React.useEffect(() => {
    let mounted = true;
    getStoredGeminiKey().then((stored) => {
      if (mounted && stored) setGeminiKey(stored);
    });
    (async () => {
      try {
        const rec = await pb
          .collection('ntfy_config')
          .getFirstListItem(`user = "${pb.authStore.record?.id}"`);
        if (!mounted) return;
        setRecordId(rec.id);
        setBaseUrl(rec.base_url ?? '');
        setTopic(rec.topic ?? '');
        setAuthType((rec.auth_type as NtfyAuthType) || 'none');
        setToken(rec.token ?? '');
        setUsername(rec.username ?? '');
        setPassword(rec.password ?? '');
      } catch {
        // no config yet — leave the form blank
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  function currentSettings() {
    return {
      base_url: baseUrl.trim().replace(/\/+$/, ''),
      topic: topic.trim(),
      auth_type: authType,
      token: token.trim(),
      username: username.trim(),
      password,
    };
  }

  async function onSave() {
    setBusy(true);
    setStatus(null);
    try {
      const data = { ...currentSettings(), user: pb.authStore.record?.id };
      if (recordId) {
        await pb.collection('ntfy_config').update(recordId, data);
      } else {
        const rec = await pb.collection('ntfy_config').create(data);
        setRecordId(rec.id);
      }
      setStatus({ kind: 'ok', text: t('settings.saved') });
    } catch (err) {
      setStatus({ kind: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  }

  async function onSaveGeminiKey() {
    setGeminiStatus(null);
    try {
      await setStoredGeminiKey(geminiKey.trim());
      setGeminiStatus({ kind: 'ok', text: t('settings.saved') });
    } catch (err) {
      setGeminiStatus({ kind: 'error', text: describeError(err) });
    }
  }

  async function onSendTest() {
    setBusy(true);
    setStatus(null);
    try {
      await sendTestNotification(currentSettings());
      setStatus({ kind: 'ok', text: t('settings.testSent') });
    } catch (err) {
      setStatus({ kind: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: t('settings.title') }} />
      <CmpKeyboardAwareScrollView
        className="flex-1 bg-background"
        contentContainerClassName="items-center p-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        bottomOffset={16}>
        <CmpCard className="w-full max-w-sm">
          <CmpCardContent className="gap-4">
            <View className="gap-1.5">
              <CmpLabel nativeID="base_url">{t('settings.baseUrl')}</CmpLabel>
              <CmpInput
                aria-labelledby="base_url"
                value={baseUrl}
                onChangeText={setBaseUrl}
                autoCapitalize="none"
                keyboardType="url"
                placeholder="https://ntfy.example.com"
                editable={!loading}
              />
            </View>
            <View className="gap-1.5">
              <CmpLabel nativeID="topic">{t('settings.topic')}</CmpLabel>
              <CmpInput
                aria-labelledby="topic"
                value={topic}
                onChangeText={setTopic}
                autoCapitalize="none"
                placeholder="my-reminders"
                editable={!loading}
              />
            </View>
            <View className="gap-1.5">
              <CmpLabel nativeID="auth_type">{t('settings.authentication')}</CmpLabel>
              <CmpSelect
                value={authOptions.find((o) => o.value === authType)}
                onValueChange={(option) => {
                  if (option) setAuthType(option.value as NtfyAuthType);
                }}>
                <CmpSelectTrigger aria-labelledby="auth_type">
                  <CmpSelectValue placeholder={t('settings.authPlaceholder')} />
                </CmpSelectTrigger>
                <CmpSelectContent>
                  {authOptions.map((o) => (
                    <CmpSelectItem key={o.value} value={o.value} label={o.label} />
                  ))}
                </CmpSelectContent>
              </CmpSelect>
            </View>
            {authType === 'token' ? (
              <View className="gap-1.5">
                <CmpLabel nativeID="token">{t('settings.accessToken')}</CmpLabel>
                <CmpInput
                  aria-labelledby="token"
                  value={token}
                  onChangeText={setToken}
                  autoCapitalize="none"
                  secureTextEntry
                  placeholder="tk_…"
                />
              </View>
            ) : null}
            {authType === 'basic' ? (
              <>
                <View className="gap-1.5">
                  <CmpLabel nativeID="username">{t('settings.username')}</CmpLabel>
                  <CmpInput
                    aria-labelledby="username"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                  />
                </View>
                <View className="gap-1.5">
                  <CmpLabel nativeID="password">{t('settings.password')}</CmpLabel>
                  <CmpInput
                    aria-labelledby="password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                  />
                </View>
              </>
            ) : null}
            <View className="gap-1.5">
              <CmpLabel nativeID="language">{t('settings.language')}</CmpLabel>
              <CmpSelect
                value={LANGUAGE_OPTIONS.find((o) => o.value === i18n.language)}
                onValueChange={(option) => {
                  if (option) setAppLanguage(option.value as AppLanguage);
                }}>
                <CmpSelectTrigger aria-labelledby="language">
                  <CmpSelectValue placeholder={t('settings.languagePlaceholder')} />
                </CmpSelectTrigger>
                <CmpSelectContent>
                  {LANGUAGE_OPTIONS.map((o) => (
                    <CmpSelectItem key={o.value} value={o.value} label={o.label} />
                  ))}
                </CmpSelectContent>
              </CmpSelect>
            </View>
            {status ? (
              <CmpText
                className={
                  status.kind === 'ok' ? 'text-sm text-green-600' : 'text-sm text-destructive'
                }>
                {status.text}
              </CmpText>
            ) : null}
            <CmpButton onPress={onSave} disabled={busy || loading || !baseUrl || !topic}>
              <CmpText>{busy ? t('common.working') : t('common.save')}</CmpText>
            </CmpButton>
            <CmpButton
              variant="secondary"
              onPress={onSendTest}
              disabled={busy || loading || !baseUrl || !topic}>
              <CmpText>{t('settings.sendTest')}</CmpText>
            </CmpButton>
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
              <CmpText className="text-xs text-muted-foreground">
                {t('settings.geminiKeyHint')}
              </CmpText>
            </View>
            {geminiStatus ? (
              <CmpText
                className={
                  geminiStatus.kind === 'ok' ? 'text-sm text-green-600' : 'text-sm text-destructive'
                }>
                {geminiStatus.text}
              </CmpText>
            ) : null}
            <CmpButton variant="secondary" onPress={onSaveGeminiKey}>
              <CmpText>{t('settings.saveGeminiKey')}</CmpText>
            </CmpButton>
          </CmpCardContent>
        </CmpCard>
      </CmpKeyboardAwareScrollView>
    </>
  );
}
