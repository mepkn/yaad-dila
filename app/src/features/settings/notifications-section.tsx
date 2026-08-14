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
import {
  loadNtfyConfig,
  saveNtfyConfig,
  sendTestNotification,
  type NtfyAuthType,
} from '@/lib/ntfy';
import { useAction } from '@/lib/use-action';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

const AUTH_VALUES: NtfyAuthType[] = ['none', 'token', 'basic'];

// Value codes stay at module scope; their labels are resolved with t() at
// render, or they would not update on a language switch.
const AUTH_LABEL_KEYS: Record<NtfyAuthType, string> = {
  none: 'settings.authNone',
  token: 'settings.authToken',
  basic: 'settings.authBasic',
};

export function NotificationsSection() {
  const { t } = useTranslation();
  const authOptions = AUTH_VALUES.map((value) => ({ value, label: t(AUTH_LABEL_KEYS[value]) }));
  const [baseUrl, setBaseUrl] = React.useState('');
  const [topic, setTopic] = React.useState('');
  const [authType, setAuthType] = React.useState<NtfyAuthType>('none');
  const [token, setToken] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const config = await loadNtfyConfig();
        if (!mounted || !config) return;
        setBaseUrl(config.base_url);
        setTopic(config.topic);
        setAuthType(config.auth_type);
        setToken(config.token);
        setUsername(config.username);
        setPassword(config.password);
      } catch {
        // Unreachable server or a stale token: leave the form as it is rather
        // than inviting the user to overwrite a config we failed to read.
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Raw field values — saveNtfyConfig and sendTestNotification both normalize,
  // so a test can never exercise a different URL from the one that gets stored.
  function currentSettings() {
    return { base_url: baseUrl, topic, auth_type: authType, token, username, password };
  }

  const saveConfig = useAction(() => saveNtfyConfig(currentSettings()), {
    success: t('settings.saved'),
  });

  const sendTest = useAction(() => sendTestNotification(currentSettings()), {
    success: t('settings.testSent'),
  });

  // One status line serves both buttons, so whichever runs takes it over from
  // the other; both are disabled while either is in flight.
  const busy = saveConfig.busy || sendTest.busy;
  const status = saveConfig.status ?? sendTest.status;

  function onSave() {
    sendTest.clear();
    saveConfig.run();
  }

  function onSendTest() {
    saveConfig.clear();
    sendTest.run();
  }

  return (
    <CmpCard className="w-full max-w-sm">
      <CmpCardHeader>
        <CmpCardTitle>{t('settings.sectionNotifications')}</CmpCardTitle>
      </CmpCardHeader>
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
      </CmpCardContent>
    </CmpCard>
  );
}
