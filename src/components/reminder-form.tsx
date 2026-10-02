import { useMutation, useQuery } from "convex/react";
import { Plus } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { START_GRACE_MS, type IntervalUnit, type RepeatMode } from "@convex/lib/schedule";
import { CmpBadge } from "@/components/cmp/cmp-badge";
import { CmpButton } from "@/components/cmp/cmp-button";
import { CmpFieldFrame, CmpInput, CmpTextarea } from "@/components/cmp/cmp-field";
import { CmpPromptDialog } from "@/components/cmp/cmp-prompt-dialog";
import { CmpSegmented } from "@/components/cmp/cmp-segmented";
import { CmpSelect } from "@/components/cmp/cmp-select";
import { CmpText } from "@/components/cmp/cmp-text";
import { DateTimeField } from "@/components/date-time-field";
import type { ReminderDraft } from "@/lib/draft";
import { errorCode, errorMessage } from "@/lib/errors";
import { unitLabel } from "@/lib/format";

export type ReminderFormValues = ReminderDraft & { tagIds: Id<"tags">[] };

export type ReminderInput = ReminderFormValues & { timeZone: string };

type Props = {
  initial: ReminderFormValues;
  submitLabel: string;
  onSubmit: (input: ReminderInput) => Promise<void>;
  // Rendered above the fields, inside the scroll view.
  header?: React.ReactNode;
  footer?: React.ReactNode;
  // Editing a saved reminder rather than creating one.
  existing?: boolean;
};

type Field = "title" | "message" | "intervalCount" | "repeatTimes";

const UNITS: IntervalUnit[] = ["minutes", "hours", "days", "weeks", "months"];

// Which field a server error code belongs to.
const FIELD_FOR_CODE: Record<string, Field> = {
  titleRequired: "title",
  titleTooLong: "title",
  messageRequired: "message",
  messageTooLong: "message",
  invalidIntervalCount: "intervalCount",
  invalidRepeatTimes: "repeatTimes",
};

function parseWhole(value: string, max: number): number | undefined {
  if (!/^\d+$/.test(value.trim())) return undefined;
  const n = Number(value);
  return n >= 1 && n <= max ? n : undefined;
}

export function ReminderForm({ initial, submitLabel, onSubmit, header, footer, existing }: Props) {
  const { t } = useTranslation();
  const tags = useQuery(api.tags.list);
  const createTag = useMutation(api.tags.create);

  const [title, setTitle] = useState(initial.title);
  const [message, setMessage] = useState(initial.message);
  const [note, setNote] = useState(initial.note ?? "");
  const [tagIds, setTagIds] = useState<Id<"tags">[]>(initial.tagIds);
  const [startAt, setStartAt] = useState(initial.startAt);
  const [intervalCount, setIntervalCount] = useState(String(initial.intervalCount));
  const [intervalUnit, setIntervalUnit] = useState<IntervalUnit>(initial.intervalUnit);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>(initial.repeatMode);
  const [repeatTimes, setRepeatTimes] = useState(String(initial.repeatTimes ?? 3));

  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [tagError, setTagError] = useState<string>();

  const [openedAt] = useState(() => Date.now());

  const countNumber = parseWhole(intervalCount, 1000) ?? 1;

  function toggleTag(id: Id<"tags">) {
    setTagIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  async function addTag(name: string) {
    setTagError(undefined);
    try {
      const id = await createTag({ name });
      setTagIds((ids) => [...ids, id]);
      setTagDialogOpen(false);
    } catch (e) {
      setTagError(errorMessage(t, e));
    }
  }

  async function submit() {
    const next: Partial<Record<Field, string>> = {};
    if (!title.trim()) next.title = t("form.errors.titleRequired");
    if (!message.trim()) next.message = t("form.errors.messageRequired");
    const count = repeatMode === "once" ? 1 : parseWhole(intervalCount, 1000);
    if (count === undefined) next.intervalCount = t("form.errors.invalidIntervalCount");
    const times = repeatMode === "count" ? parseWhole(repeatTimes, 10000) : undefined;
    if (repeatMode === "count" && times === undefined) {
      next.repeatTimes = t("form.errors.invalidRepeatTimes");
    }
    setErrors(next);
    setFormError(undefined);
    if (Object.keys(next).length > 0 || count === undefined) return;

    setSubmitting(true);
    try {
      await onSubmit({
        title,
        message,
        note: note.trim() || undefined,
        tagIds,
        startAt,
        intervalCount: count,
        intervalUnit: repeatMode === "once" ? "days" : intervalUnit,
        repeatMode,
        repeatTimes: times,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    } catch (e) {
      const code = errorCode(e);
      const field = code ? FIELD_FOR_CODE[code] : undefined;
      if (field) setErrors({ [field]: errorMessage(t, e) });
      else setFormError(errorMessage(t, e));
    } finally {
      setSubmitting(false);
    }
  }

  // An existing reminder's start is usually in the past; only warn about a start
  // the user just picked (or a new reminder's).
  const startEdited = startAt !== initial.startAt || !existing;
  const startPassed = startEdited && startAt < openedAt - START_GRACE_MS;

  return (
    <KeyboardAvoidingView
      className="bg-background flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerClassName="gap-5 p-4 pb-12" keyboardShouldPersistTaps="handled">
        {header}
        <CmpInput
          label={t("form.title")}
          placeholder={t("form.titlePlaceholder")}
          value={title}
          onChangeText={setTitle}
          error={errors.title}
          maxLength={200}
        />
        <CmpInput
          label={t("form.message")}
          placeholder={t("form.messagePlaceholder")}
          value={message}
          onChangeText={setMessage}
          error={errors.message}
          maxLength={1000}
        />
        <CmpTextarea
          label={t("form.note")}
          placeholder={t("form.notePlaceholder")}
          value={note}
          onChangeText={setNote}
          maxLength={5000}
        />

        <CmpFieldFrame label={t("form.tags")}>
          {/* Chips and the New tag button share one height so the row lines up. */}
          <View className="flex-row flex-wrap items-center gap-2">
            {(tags ?? []).map((tag) => {
              const selected = tagIds.includes(tag._id);
              return (
                <Pressable
                  key={tag._id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  onPress={() => toggleTag(tag._id)}>
                  <CmpBadge
                    className="h-8 px-3"
                    variant={selected ? "default" : "outline"}
                    label={tag.name}
                  />
                </Pressable>
              );
            })}
            <CmpButton
              size="sm"
              variant="ghost"
              className="h-8"
              icon={Plus}
              label={t("form.newTag")}
              onPress={() => {
                setTagError(undefined);
                setTagDialogOpen(true);
              }}
            />
          </View>
        </CmpFieldFrame>

        <CmpFieldFrame
          label={t("form.start")}
          hint={startPassed ? t("form.pastStartHint") : undefined}>
          <DateTimeField value={startAt} onChange={setStartAt} />
        </CmpFieldFrame>

        <CmpFieldFrame label={t("form.repeat")}>
          <CmpSegmented
            value={repeatMode}
            onChange={setRepeatMode}
            options={(["once", "forever", "count"] as const).map((value) => ({
              value,
              label: t(`form.repeatModes.${value}`),
            }))}
          />
        </CmpFieldFrame>

        {repeatMode !== "once" && (
          <CmpFieldFrame label={t("form.every")} error={errors.intervalCount}>
            <View className="flex-row gap-2">
              <CmpInput
                className={errors.intervalCount ? "border-destructive w-24" : "w-24"}
                accessibilityLabel={t("form.intervalCount")}
                keyboardType="number-pad"
                value={intervalCount}
                onChangeText={setIntervalCount}
                maxLength={4}
              />
              <View className="flex-1">
                <CmpSelect
                  value={intervalUnit}
                  onChange={setIntervalUnit}
                  options={UNITS.map((unit) => ({
                    value: unit,
                    label: unitLabel(t, unit, countNumber),
                  }))}
                />
              </View>
            </View>
          </CmpFieldFrame>
        )}

        {repeatMode === "count" && (
          <CmpInput
            label={t("form.repeatTimes")}
            keyboardType="number-pad"
            value={repeatTimes}
            onChangeText={setRepeatTimes}
            error={errors.repeatTimes}
            maxLength={5}
          />
        )}

        {formError && <CmpText className="text-destructive">{formError}</CmpText>}
        <CmpButton size="lg" label={submitLabel} loading={submitting} onPress={submit} />
        {footer}
      </ScrollView>

      <CmpPromptDialog
        open={tagDialogOpen}
        onOpenChange={setTagDialogOpen}
        title={t("form.newTagTitle")}
        placeholder={t("form.tagName")}
        error={tagError}
        submitLabel={t("common.create")}
        cancelLabel={t("common.cancel")}
        onSubmit={addTag}
      />
    </KeyboardAvoidingView>
  );
}
