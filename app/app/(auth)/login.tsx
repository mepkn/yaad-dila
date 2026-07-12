import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { describeError } from '@/lib/errors';
import { pb } from '@/lib/pb';
import { Link } from 'expo-router';
import * as React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

export default function LoginScreen() {
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
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerClassName="flex-grow items-center justify-center p-4"
        keyboardShouldPersistTaps="handled">
        <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Log in</CardTitle>
        </CardHeader>
        <CardContent className="gap-4">
          <View className="gap-1.5">
            <Label nativeID="email">Email</Label>
            <Input
              aria-labelledby="email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="you@example.com"
            />
          </View>
          <View className="gap-1.5">
            <Label nativeID="password">Password</Label>
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
            <Text>{busy ? 'Logging in…' : 'Log in'}</Text>
          </Button>
          <Link href="/(auth)/signup" asChild>
            <Button variant="ghost">
              <Text>No account? Sign up</Text>
            </Button>
          </Link>
        </CardContent>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
