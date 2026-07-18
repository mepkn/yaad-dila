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
import { describeError } from '@/lib/errors';
import { pb } from '@/lib/pb';
import { sendTestNotification, type NtfyAuthType } from '@/lib/ntfy';
import { LANGUAGE_OPTIONS, setAppLanguage } from '@/lib/i18n';
import { type AppLanguage } from '@/lib/locale-preference';
import { Stack } from 'expo-router';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardAwareScrollView } from '@/components/keyboard-aware-scroll-view';

const AUTH_VALUES: NtfyAuthType[] = ['none', 'token', 'basic'];

const AUTH_LABEL_KEYS: Record<NtfyAuthType, string> = {
  none: 'settings.authNone',
  token: 'settings.authToken',
  basic: 'settings.authBasic',
};

export default function SettingsScreen() {
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
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  React.useEffect(() => {
    let mounted = true;
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
      <KeyboardAwareScrollView
        className="flex-1 bg-background"
        contentContainerClassName="items-center p-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        bottomOffset={16}
        keyboardShouldPersistTaps="handled">
        <Card className="w-full max-w-sm">
          <CardContent className="gap-4">
            <View className="gap-1.5">
              <Label nativeID="base_url">{t('settings.baseUrl')}</Label>
              <Input
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
              <Label nativeID="topic">{t('settings.topic')}</Label>
              <Input
                aria-labelledby="topic"
                value={topic}
                onChangeText={setTopic}
                autoCapitalize="none"
                placeholder="my-reminders"
                editable={!loading}
              />
            </View>
            <View className="gap-1.5">
              <Label nativeID="auth_type">{t('settings.authentication')}</Label>
              <Select
                value={authOptions.find((o) => o.value === authType)}
                onValueChange={(option) => {
                  if (option) setAuthType(option.value as NtfyAuthType);
                }}>
                <SelectTrigger aria-labelledby="auth_type">
                  <SelectValue placeholder={t('settings.authPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {authOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value} label={o.label} />
                  ))}
                </SelectContent>
              </Select>
            </View>
            {authType === 'token' ? (
              <View className="gap-1.5">
                <Label nativeID="token">{t('settings.accessToken')}</Label>
                <Input
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
                  <Label nativeID="username">{t('settings.username')}</Label>
                  <Input
                    aria-labelledby="username"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                  />
                </View>
                <View className="gap-1.5">
                  <Label nativeID="password">{t('settings.password')}</Label>
                  <Input
                    aria-labelledby="password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                  />
                </View>
              </>
            ) : null}
            <View className="gap-1.5">
              <Label nativeID="language">{t('settings.language')}</Label>
              <Select
                value={LANGUAGE_OPTIONS.find((o) => o.value === i18n.language)}
                onValueChange={(option) => {
                  if (option) setAppLanguage(option.value as AppLanguage);
                }}>
                <SelectTrigger aria-labelledby="language">
                  <SelectValue placeholder={t('settings.languagePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} label={o.label} />
                  ))}
                </SelectContent>
              </Select>
            </View>
            {status ? (
              <Text
                className={
                  status.kind === 'ok' ? 'text-sm text-green-600' : 'text-sm text-destructive'
                }>
                {status.text}
              </Text>
            ) : null}
            <Button onPress={onSave} disabled={busy || loading || !baseUrl || !topic}>
              <Text>{busy ? t('common.working') : t('common.save')}</Text>
            </Button>
            <Button
              variant="secondary"
              onPress={onSendTest}
              disabled={busy || loading || !baseUrl || !topic}>
              <Text>{t('settings.sendTest')}</Text>
            </Button>
          </CardContent>
          </Card>
      </KeyboardAwareScrollView>
    </>
  );
}
