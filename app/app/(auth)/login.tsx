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

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

  async function onLogin() {
    setBusy(true);
    setError('');
    try {
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
          <CardTitle>{t('auth.login')}</CardTitle>
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
              placeholder="••••••••"
            />
          </View>
          {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
          <Button onPress={onLogin} disabled={busy || !email || !password}>
            <Text>{busy ? t('auth.loggingIn') : t('auth.login')}</Text>
          </Button>
          <Link href="/(auth)/signup" asChild>
            <Button variant="ghost">
              <Text>{t('auth.noAccount')}</Text>
            </Button>
          </Link>
        </CardContent>
        </Card>
    </KeyboardAwareScrollView>
  );
}
