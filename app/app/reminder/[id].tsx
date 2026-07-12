import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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
import { Textarea } from '@/components/ui/textarea';
import { describeError } from '@/lib/errors';
import { pb } from '@/lib/pb';
import {
  formatLocal,
  parseUTC,
  type IntervalUnit,
  type Reminder,
  type RepeatMode,
} from '@/lib/reminders';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

const UNIT_OPTIONS: { value: IntervalUnit; label: string }[] = [
  { value: 'minutes', label: 'Minutes' },
  { value: 'hours', label: 'Hours' },
  { value: 'days', label: 'Days' },
  { value: 'weeks', label: 'Weeks' },
  { value: 'months', label: 'Months' },
];

const REPEAT_OPTIONS: { value: RepeatMode; label: string }[] = [
  { value: 'once', label: 'Once' },
  { value: 'forever', label: 'Forever' },
  { value: 'count', label: 'Stop after N times' },
];

const PRIORITY_OPTIONS = [
  { value: '1', label: '1 — Min' },
  { value: '2', label: '2 — Low' },
  { value: '3', label: '3 — Default' },
  { value: '4', label: '4 — High' },
  { value: '5', label: '5 — Max' },
];

export default function ReminderFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const router = useRouter();

  const [title, setTitle] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [priority, setPriority] = React.useState('3');
  const [intervalN, setIntervalN] = React.useState('1');
  const [intervalUnit, setIntervalUnit] = React.useState<IntervalUnit>('days');
  const [repeatMode, setRepeatMode] = React.useState<RepeatMode>('once');
  const [repeatCount, setRepeatCount] = React.useState('2');
  const [startAt, setStartAt] = React.useState<Date>(() => new Date());
  const [showIosPicker, setShowIosPicker] = React.useState(false);
  const [lastError, setLastError] = React.useState('');
  const [loading, setLoading] = React.useState(!isNew);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isNew) return;
    let mounted = true;
    (async () => {
      try {
        const rec = await pb.collection('reminders').getOne<Reminder>(id);
        if (!mounted) return;
        setTitle(rec.title);
        setMessage(rec.message);
        setPriority(String(rec.priority || 3));
        setIntervalN(String(rec.interval_n));
        setIntervalUnit(rec.interval_unit);
        setRepeatMode(rec.repeat_mode);
        if (rec.repeat_count >= 1) setRepeatCount(String(rec.repeat_count));
        setStartAt(parseUTC(rec.start_at));
        setLastError(rec.last_error ?? '');
      } catch (err) {
        if (mounted) setError(describeError(err));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id, isNew]);

  // Android has no combined datetime mode — chain a date picker into a time picker.
  function onPickStartAt() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: startAt,
        mode: 'date',
        onChange: (event: DateTimePickerEvent, date?: Date) => {
          if (event.type !== 'set' || !date) return;
          DateTimePickerAndroid.open({
            value: date,
            mode: 'time',
            onChange: (timeEvent: DateTimePickerEvent, dateTime?: Date) => {
              if (timeEvent.type === 'set' && dateTime) setStartAt(dateTime);
            },
          });
        },
      });
    } else {
      setShowIosPicker((v) => !v);
    }
  }

  async function onSave() {
    setBusy(true);
    setError(null);
    try {
      const data: Record<string, unknown> = {
        user: pb.authStore.record?.id,
        title: title.trim(),
        message: message.trim(),
        priority: Number(priority),
        interval_n: Number(intervalN),
        interval_unit: intervalUnit,
        repeat_mode: repeatMode,
        repeat_count: repeatMode === 'count' ? Number(repeatCount) : 0,
        // Local Date → UTC ISO string. The backend computes next_fire.
        start_at: startAt.toISOString(),
      };
      if (isNew) {
        await pb.collection('reminders').create(data);
      } else {
        await pb.collection('reminders').update(id, data);
      }
      router.back();
    } catch (err) {
      setError(describeError(err));
      setBusy(false);
    }
  }

  async function onDelete() {
    setBusy(true);
    setError(null);
    try {
      await pb.collection('reminders').delete(id);
      router.back();
    } catch (err) {
      setError(describeError(err));
      setBusy(false);
    }
  }

  const canSave =
    !loading &&
    !busy &&
    title.trim().length > 0 &&
    message.trim().length > 0 &&
    Number(intervalN) >= 1 &&
    (repeatMode !== 'count' || Number(repeatCount) >= 1);

  return (
    <>
      <Stack.Screen options={{ title: isNew ? 'New reminder' : 'Edit reminder' }} />
      <KeyboardAvoidingView
        className="flex-1 bg-background"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerClassName="items-center p-4"
          keyboardShouldPersistTaps="handled">
          <Card className="w-full max-w-sm">
            <CardHeader>
              <CardTitle>{isNew ? 'New reminder' : 'Edit reminder'}</CardTitle>
            </CardHeader>
            <CardContent className="gap-4">
              {lastError ? (
                <Text className="text-sm text-destructive">Last send failed: {lastError}</Text>
              ) : null}
              <View className="gap-1.5">
                <Label nativeID="title">Title</Label>
                <Input
                  aria-labelledby="title"
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Water the plants"
                  editable={!loading}
                />
              </View>
              <View className="gap-1.5">
                <Label nativeID="message">Message</Label>
                <Textarea
                  aria-labelledby="message"
                  value={message}
                  onChangeText={setMessage}
                  placeholder="They are thirsty."
                  editable={!loading}
                />
              </View>
              <View className="gap-1.5">
                <Label>Starts</Label>
                <Button variant="outline" onPress={onPickStartAt} disabled={loading}>
                  <Text>{formatLocal(startAt.toISOString())}</Text>
                </Button>
                {showIosPicker && Platform.OS === 'ios' ? (
                  <DateTimePicker
                    value={startAt}
                    mode="datetime"
                    display="spinner"
                    onChange={(event: DateTimePickerEvent, date?: Date) => {
                      if (date) setStartAt(date);
                    }}
                  />
                ) : null}
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1 gap-1.5">
                  <Label nativeID="interval_n">Every</Label>
                  <Input
                    aria-labelledby="interval_n"
                    value={intervalN}
                    onChangeText={setIntervalN}
                    keyboardType="number-pad"
                    editable={!loading}
                  />
                </View>
                <View className="flex-[2] gap-1.5">
                  <Label nativeID="interval_unit">Unit</Label>
                  <Select
                    value={UNIT_OPTIONS.find((o) => o.value === intervalUnit)}
                    onValueChange={(option) => {
                      if (option) setIntervalUnit(option.value as IntervalUnit);
                    }}>
                    <SelectTrigger aria-labelledby="interval_unit">
                      <SelectValue placeholder="Unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value} label={o.label} />
                      ))}
                    </SelectContent>
                  </Select>
                </View>
              </View>
              <View className="gap-1.5">
                <Label nativeID="repeat_mode">Repeat</Label>
                <Select
                  value={REPEAT_OPTIONS.find((o) => o.value === repeatMode)}
                  onValueChange={(option) => {
                    if (option) setRepeatMode(option.value as RepeatMode);
                  }}>
                  <SelectTrigger aria-labelledby="repeat_mode">
                    <SelectValue placeholder="Repeat" />
                  </SelectTrigger>
                  <SelectContent>
                    {REPEAT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value} label={o.label} />
                    ))}
                  </SelectContent>
                </Select>
              </View>
              {repeatMode === 'count' ? (
                <View className="gap-1.5">
                  <Label nativeID="repeat_count">Total fires</Label>
                  <Input
                    aria-labelledby="repeat_count"
                    value={repeatCount}
                    onChangeText={setRepeatCount}
                    keyboardType="number-pad"
                    editable={!loading}
                  />
                </View>
              ) : null}
              <View className="gap-1.5">
                <Label nativeID="priority">Priority</Label>
                <Select
                  value={PRIORITY_OPTIONS.find((o) => o.value === priority)}
                  onValueChange={(option) => {
                    if (option) setPriority(option.value);
                  }}>
                  <SelectTrigger aria-labelledby="priority">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value} label={o.label} />
                    ))}
                  </SelectContent>
                </Select>
              </View>
              {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
              <Button onPress={onSave} disabled={!canSave}>
                <Text>{busy ? 'Working…' : isNew ? 'Create' : 'Save'}</Text>
              </Button>
              {!isNew ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={busy || loading}>
                      <Text>Delete</Text>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this reminder?</AlertDialogTitle>
                      <AlertDialogDescription>
                        “{title}” will stop firing and cannot be recovered.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>
                        <Text>Cancel</Text>
                      </AlertDialogCancel>
                      <AlertDialogAction onPress={onDelete}>
                        <Text>Delete</Text>
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
            </CardContent>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
