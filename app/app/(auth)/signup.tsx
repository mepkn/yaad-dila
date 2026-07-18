import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { describeError } from '@/lib/errors';
import { pb } from '@/lib/pb';
import { Link } from 'expo-router';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardAwareScrollView } from '@/components/keyboard-aware-scroll-view';

export default function SignupScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

  async function onSignup() {
    if (password !== confirm) {
      setError(t('auth.passwordsMismatch'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await pb.collection('users').create({
        email: email.trim(),
        password,
        passwordConfirm: confirm,
      });
      await pb.collection('users').authWithPassword(email.trim(), password);
      // Root layout redirects on auth change.
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAwareScrollView
      className="flex-1 bg-background"
      contentContainerClassName="flex-grow items-center justify-center p-4"
      contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      bottomOffset={16}
      keyboardShouldPersistTaps="handled">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>{t('auth.signup')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-4">
            <View className="gap-1.5">
              <Label nativeID="email">{t('auth.email')}</Label>
              <Input
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
              <Label nativeID="password">{t('auth.password')}</Label>
              <Input
                aria-labelledby="password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder={t('auth.passwordPlaceholder')}
              />
            </View>
            <View className="gap-1.5">
              <Label nativeID="confirm">{t('auth.confirmPassword')}</Label>
              <Input
                aria-labelledby="confirm"
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry
                placeholder={t('auth.confirmPlaceholder')}
              />
            </View>
            {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
            <Button onPress={onSignup} disabled={busy || !email || !password || !confirm}>
              <Text>{busy ? t('auth.creatingAccount') : t('auth.signup')}</Text>
            </Button>
            <Link href="/(auth)/login" asChild>
              <Button variant="ghost">
                <Text>{t('auth.haveAccount')}</Text>
              </Button>
            </Link>
          </CardContent>
        </Card>
    </KeyboardAwareScrollView>
  );
}
