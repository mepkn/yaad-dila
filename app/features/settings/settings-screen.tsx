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
import { changePassword, MIN_PASSWORD_LENGTH } from '@/lib/auth';
import { pb } from '@/lib/pb';
import {
  loadNtfyConfig,
  saveNtfyConfig,
  sendTestNotification,
  type NtfyAuthType,
} from '@/lib/ntfy';
import { getStoredGeminiKey, setStoredGeminiKey } from '@/lib/gemini';
import { LANGUAGE_OPTIONS, setAppLanguage } from '@/lib/i18n';
import { type AppLanguage } from '@/lib/locale-preference';
import { useAction } from '@/lib/use-action';
import {
  getStoredTheme,
  setStoredTheme,
  THEME_OPTIONS,
  type AppTheme,
} from '@/lib/theme-preference';
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const AUTH_VALUES: NtfyAuthType[] = ['none', 'token', 'basic'];

// Value codes stay at module scope; their labels are resolved with t() at
// render, or they would not update on a language switch.
const AUTH_LABEL_KEYS: Record<NtfyAuthType, string> = {
  none: 'settings.authNone',
  token: 'settings.authToken',
  basic: 'settings.authBasic',
};

const THEME_LABEL_KEYS: Record<AppTheme, string> = {
  system: 'settings.themeSystem',
  light: 'settings.themeLight',
  dark: 'settings.themeDark',
};

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const { setColorScheme } = useColorScheme();
  const authOptions = AUTH_VALUES.map((value) => ({ value, label: t(AUTH_LABEL_KEYS[value]) }));
  const themeOptions = THEME_OPTIONS.map((value) => ({ value, label: t(THEME_LABEL_KEYS[value]) }));
  const [baseUrl, setBaseUrl] = React.useState('');
  const [topic, setTopic] = React.useState('');
  const [authType, setAuthType] = React.useState<NtfyAuthType>('none');
  const [token, setToken] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [geminiKey, setGeminiKey] = React.useState('');
  // Bound to the STORED preference, not to useColorScheme().colorScheme —
  // NativeWind only ever reports the resolved scheme, so a select bound to it
  // would show "Light" the moment you picked "System".
  const [theme, setTheme] = React.useState<AppTheme>('system');
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [passwordOpen, setPasswordOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    getStoredGeminiKey().then((stored) => {
      if (mounted && stored) setGeminiKey(stored);
    });
    getStoredTheme().then((stored) => {
      if (mounted && stored) setTheme(stored);
    });
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

  const saveGeminiKey = useAction(() => setStoredGeminiKey(geminiKey.trim()), {
    success: t('settings.saved'),
  });

  const changeUserPassword = useAction(
    async () => {
      // Cheap checks first — no point spending a round-trip on a typo. Thrown
      // rather than returned early: describeError passes a plain Error's
      // message straight through, so these read like any other failure.
      if (newPassword !== confirmPassword) {
        throw new Error(t('settings.passwordMismatch'));
      }
      if (newPassword.length < MIN_PASSWORD_LENGTH) {
        throw new Error(t('settings.passwordTooShort', { min: MIN_PASSWORD_LENGTH }));
      }
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    { success: t('settings.passwordChanged') }
  );

  // The ntfy card shows one status line for both of its buttons, so whichever
  // runs takes the line over from the other.
  const ntfyBusy = saveConfig.busy || sendTest.busy;
  const ntfyStatus = saveConfig.status ?? sendTest.status;

  function onSave() {
    sendTest.clear();
    saveConfig.run();
  }

  function onSendTest() {
    saveConfig.clear();
    sendTest.run();
  }

  function onChangeTheme(next: AppTheme) {
    setTheme(next);
    setColorScheme(next);
    setStoredTheme(next);
  }

  return (
    <CmpKeyboardAwareScrollView
      className="flex-1 bg-background"
      contentContainerClassName="items-center gap-4 p-4"
      // iOS auto-adjusts a screen's first scroll view by the safe-area inset,
      // which would stack on top of the padding below and indent the first card
      // twice. Opting out keeps one source of truth and makes both platforms
      // behave the same. The bottom value must also clear the tab bar, which
      // NativeTabs does not let us measure.
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 96 }}
      bottomOffset={16}>
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
          {ntfyStatus ? (
            <CmpText
              className={
                ntfyStatus.kind === 'ok' ? 'text-sm text-green-600' : 'text-sm text-destructive'
              }>
              {ntfyStatus.text}
            </CmpText>
          ) : null}
          <CmpButton onPress={onSave} disabled={ntfyBusy || loading || !baseUrl || !topic}>
            <CmpText>{ntfyBusy ? t('common.working') : t('common.save')}</CmpText>
          </CmpButton>
          <CmpButton
            variant="secondary"
            onPress={onSendTest}
            disabled={ntfyBusy || loading || !baseUrl || !topic}>
            <CmpText>{t('settings.sendTest')}</CmpText>
          </CmpButton>
        </CmpCardContent>
      </CmpCard>

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
            <CmpText className="text-xs text-muted-foreground">
              {t('settings.geminiKeyHint')}
            </CmpText>
          </View>
          {saveGeminiKey.status ? (
            <CmpText
              className={
                saveGeminiKey.status.kind === 'ok'
                  ? 'text-sm text-green-600'
                  : 'text-sm text-destructive'
              }>
              {saveGeminiKey.status.text}
            </CmpText>
          ) : null}
          <CmpButton variant="secondary" onPress={saveGeminiKey.run}>
            <CmpText>{t('settings.saveGeminiKey')}</CmpText>
          </CmpButton>
        </CmpCardContent>
      </CmpCard>

      <CmpCard className="w-full max-w-sm">
        <CmpCardHeader>
          <CmpCardTitle>{t('settings.sectionAppearance')}</CmpCardTitle>
        </CmpCardHeader>
        <CmpCardContent className="gap-4">
          <View className="gap-1.5">
            <CmpLabel nativeID="theme">{t('settings.theme')}</CmpLabel>
            <CmpSelect
              value={themeOptions.find((o) => o.value === theme)}
              onValueChange={(option) => {
                if (option) onChangeTheme(option.value as AppTheme);
              }}>
              <CmpSelectTrigger aria-labelledby="theme">
                <CmpSelectValue placeholder={t('settings.theme')} />
              </CmpSelectTrigger>
              <CmpSelectContent>
                {themeOptions.map((o) => (
                  <CmpSelectItem key={o.value} value={o.value} label={o.label} />
                ))}
              </CmpSelectContent>
            </CmpSelect>
          </View>
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
        </CmpCardContent>
      </CmpCard>

      <CmpCard className="w-full max-w-sm">
        <CmpCardHeader>
          <CmpCardTitle>{t('settings.sectionAccount')}</CmpCardTitle>
        </CmpCardHeader>
        <CmpCardContent className="gap-4">
          <View className="gap-1.5">
            <CmpLabel>{t('settings.signedInAs')}</CmpLabel>
            <CmpText className="text-sm text-muted-foreground">
              {pb.authStore.record?.email ?? '—'}
            </CmpText>
          </View>
          <CmpCollapsible open={passwordOpen} onOpenChange={setPasswordOpen}>
            <CmpCollapsibleTrigger className="flex-row items-center gap-2">
              {/* CmpText, not CmpLabel: Label renders its own Pressable, which
                  swallows the press before the trigger ever sees it. flex-1 on the
                  text and shrink-0 on the icon so a longer translation is not
                  squeezed down to its first word. */}
              <CmpText className="flex-1 text-sm font-medium">
                {t('settings.changePassword')}
              </CmpText>
              <CmpIcon
                as={passwordOpen ? ChevronUpIcon : ChevronDownIcon}
                className="size-5 shrink-0 text-muted-foreground"
              />
            </CmpCollapsibleTrigger>
            <CmpCollapsibleContent>
              <View className="gap-4 pt-4">
                <View className="gap-1.5">
                  <CmpLabel nativeID="current_password">{t('settings.currentPassword')}</CmpLabel>
                  <CmpInput
                    aria-labelledby="current_password"
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    autoCapitalize="none"
                    secureTextEntry
                    placeholder="••••••••"
                  />
                </View>
                <View className="gap-1.5">
                  <CmpLabel nativeID="new_password">{t('settings.newPassword')}</CmpLabel>
                  <CmpInput
                    aria-labelledby="new_password"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    autoCapitalize="none"
                    secureTextEntry
                    placeholder="••••••••"
                  />
                </View>
                <View className="gap-1.5">
                  <CmpLabel nativeID="confirm_password">{t('settings.confirmPassword')}</CmpLabel>
                  <CmpInput
                    aria-labelledby="confirm_password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    autoCapitalize="none"
                    secureTextEntry
                    placeholder="••••••••"
                  />
                </View>
                {changeUserPassword.status ? (
                  <CmpText
                    className={
                      changeUserPassword.status.kind === 'ok'
                        ? 'text-sm text-green-600'
                        : 'text-sm text-destructive'
                    }>
                    {changeUserPassword.status.text}
                  </CmpText>
                ) : null}
                <CmpButton
                  variant="secondary"
                  onPress={changeUserPassword.run}
                  disabled={
                    changeUserPassword.busy || !currentPassword || !newPassword || !confirmPassword
                  }>
                  <CmpText>
                    {changeUserPassword.busy ? t('common.working') : t('settings.changePassword')}
                  </CmpText>
                </CmpButton>
              </View>
            </CmpCollapsibleContent>
          </CmpCollapsible>

          {/* Behind a confirm: logging out is one tap from the controls above. */}
          <CmpAlertDialog>
            <CmpAlertDialogTrigger asChild>
              <CmpButton variant="destructive">
                <CmpText>{t('settings.logout')}</CmpText>
              </CmpButton>
            </CmpAlertDialogTrigger>
            <CmpAlertDialogContent>
              <CmpAlertDialogHeader>
                <CmpAlertDialogTitle>{t('settings.logoutConfirmTitle')}</CmpAlertDialogTitle>
                <CmpAlertDialogDescription>
                  {t('settings.logoutConfirmBody')}
                </CmpAlertDialogDescription>
              </CmpAlertDialogHeader>
              <CmpAlertDialogFooter>
                <CmpAlertDialogCancel>
                  <CmpText>{t('common.cancel')}</CmpText>
                </CmpAlertDialogCancel>
                {/* The root layout's authStore.onChange swaps the protected
                    guards, so no manual navigation is needed. */}
                <CmpAlertDialogAction onPress={() => pb.authStore.clear()}>
                  <CmpText>{t('settings.logout')}</CmpText>
                </CmpAlertDialogAction>
              </CmpAlertDialogFooter>
            </CmpAlertDialogContent>
          </CmpAlertDialog>
        </CmpCardContent>
      </CmpCard>
    </CmpKeyboardAwareScrollView>
  );
}
