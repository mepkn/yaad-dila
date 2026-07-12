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

export default function SignupScreen() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

  async function onSignup() {
    if (password !== confirm) {
      setError('Passwords do not match.');
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
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerClassName="flex-grow items-center justify-center p-4"
        keyboardShouldPersistTaps="handled">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Sign up</CardTitle>
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
                placeholder="min. 8 characters"
              />
            </View>
            <View className="gap-1.5">
              <Label nativeID="confirm">Confirm password</Label>
              <Input
                aria-labelledby="confirm"
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry
                placeholder="repeat password"
              />
            </View>
            {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
            <Button onPress={onSignup} disabled={busy || !email || !password || !confirm}>
              <Text>{busy ? 'Creating account…' : 'Sign up'}</Text>
            </Button>
            <Link href="/(auth)/login" asChild>
              <Button variant="ghost">
                <Text>Have an account? Log in</Text>
              </Button>
            </Link>
          </CardContent>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
