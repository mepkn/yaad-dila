import { CmpButton } from '@/components/cmp/cmp-button';
import { CmpCard, CmpCardContent, CmpCardHeader, CmpCardTitle } from '@/components/cmp/cmp-card';
import { CmpInput } from '@/components/cmp/cmp-input';
import { CmpKeyboardAwareScrollView } from '@/components/cmp/cmp-keyboard-aware-scroll-view';
import { CmpLabel } from '@/components/cmp/cmp-label';
import { CmpText } from '@/components/cmp/cmp-text';
import { signIn } from '@/lib/auth';
import { useAction } from '@/lib/use-action';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  // Root layout redirects on auth change, so there is nothing to do on success.
  const login = useAction(() => signIn(email, password));

  return (
    <CmpKeyboardAwareScrollView
      className="flex-1 bg-background"
      contentContainerClassName="flex-grow items-center justify-center p-4"
      contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      bottomOffset={16}>
      <CmpCard className="w-full max-w-sm">
        <CmpCardHeader>
          <CmpCardTitle>{t('auth.login')}</CmpCardTitle>
        </CmpCardHeader>
        <CmpCardContent className="gap-4">
          <View className="gap-1.5">
            <CmpLabel nativeID="email">{t('auth.email')}</CmpLabel>
            <CmpInput
              aria-labelledby="email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder={t('auth.emailPlaceholder')}
            />
          </View>
          <View className="gap-1.5">
            <CmpLabel nativeID="password">{t('auth.password')}</CmpLabel>
            <CmpInput
              aria-labelledby="password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
            />
          </View>
          {login.status ? (
            <CmpText className="text-sm text-destructive">{login.status.text}</CmpText>
          ) : null}
          <CmpButton onPress={login.run} disabled={login.busy || !email || !password}>
            <CmpText>{login.busy ? t('auth.loggingIn') : t('auth.login')}</CmpText>
          </CmpButton>
          <CmpText className="text-center text-sm text-muted-foreground">
            {t('auth.adminCreatesAccounts')}
          </CmpText>
        </CmpCardContent>
      </CmpCard>
    </CmpKeyboardAwareScrollView>
  );
}
