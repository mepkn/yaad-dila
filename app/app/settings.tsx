import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Stack } from 'expo-router';
import * as React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

const AUTH_OPTIONS: { value: NtfyAuthType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'token', label: 'Token' },
  { value: 'basic', label: 'Username + password' },
];

export default function SettingsScreen() {
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
      setStatus({ kind: 'ok', text: 'Saved.' });
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
      setStatus({ kind: 'ok', text: 'Test notification sent — check your phone.' });
    } catch (err) {
      setStatus({ kind: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'ntfy settings' }} />
      <KeyboardAvoidingView
        className="flex-1 bg-background"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerClassName="items-center p-4"
          keyboardShouldPersistTaps="handled">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Your ntfy server</CardTitle>
          </CardHeader>
          <CardContent className="gap-4">
            <View className="gap-1.5">
              <Label nativeID="base_url">Base URL</Label>
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
              <Label nativeID="topic">Topic</Label>
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
              <Label nativeID="auth_type">Authentication</Label>
              <Select
                value={AUTH_OPTIONS.find((o) => o.value === authType)}
                onValueChange={(option) => {
                  if (option) setAuthType(option.value as NtfyAuthType);
                }}>
                <SelectTrigger aria-labelledby="auth_type">
                  <SelectValue placeholder="Select auth type" />
                </SelectTrigger>
                <SelectContent>
                  {AUTH_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} label={o.label} />
                  ))}
                </SelectContent>
              </Select>
            </View>
            {authType === 'token' ? (
              <View className="gap-1.5">
                <Label nativeID="token">Access token</Label>
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
                  <Label nativeID="username">Username</Label>
                  <Input
                    aria-labelledby="username"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                  />
                </View>
                <View className="gap-1.5">
                  <Label nativeID="password">Password</Label>
                  <Input
                    aria-labelledby="password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                  />
                </View>
              </>
            ) : null}
            {status ? (
              <Text
                className={
                  status.kind === 'ok' ? 'text-sm text-green-600' : 'text-sm text-destructive'
                }>
                {status.text}
              </Text>
            ) : null}
            <Button onPress={onSave} disabled={busy || loading || !baseUrl || !topic}>
              <Text>{busy ? 'Working…' : 'Save'}</Text>
            </Button>
            <Button
              variant="secondary"
              onPress={onSendTest}
              disabled={busy || loading || !baseUrl || !topic}>
              <Text>Send test notification</Text>
            </Button>
          </CardContent>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
