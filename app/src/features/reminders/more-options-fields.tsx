import { CmpCard, CmpCardContent, CmpCardTitle } from '@/components/cmp/cmp-card';
import {
  CmpCollapsible,
  CmpCollapsibleContent,
  CmpCollapsibleTrigger,
} from '@/components/cmp/cmp-collapsible';
import { CmpIcon } from '@/components/cmp/cmp-icon';
import { CmpLabel } from '@/components/cmp/cmp-label';
import {
  CmpSelect,
  CmpSelectContent,
  CmpSelectItem,
  CmpSelectTrigger,
  CmpSelectValue,
} from '@/components/cmp/cmp-select';
import { CmpTextarea } from '@/components/cmp/cmp-textarea';
import type { DraftUpdate } from '@/features/reminders/draft-update';
import { TagInput } from '@/features/reminders/tag-input';
import { type ReminderDraft } from '@/lib/reminders';
import { listTags, type Tag } from '@/lib/tags';
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react-native';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

const PRIORITY_VALUES = ['1', '2', '3', '4', '5'] as const;

interface MoreOptionsFieldsProps {
  draft: ReminderDraft;
  update: DraftUpdate;
  editable: boolean;
  /**
   * Owned by the screen: the section opens itself once when a loaded reminder
   * already uses any of these fields, which is a fact about the moment the
   * record arrives rather than about this card.
   */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MoreOptionsFields({
  draft,
  update,
  editable,
  open,
  onOpenChange,
}: MoreOptionsFieldsProps) {
  const { t } = useTranslation();
  // Suggestions belong to the tag input and nothing else on the form uses them.
  const [allTags, setAllTags] = React.useState<Tag[]>([]);

  const priorityOptions = PRIORITY_VALUES.map((value) => ({
    value,
    label: t(`reminder.priority${value}`),
  }));

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const records = await listTags();
        if (mounted) setAllTags(records);
      } catch {
        // Suggestions are optional; tag loading must not block the form.
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <CmpCollapsible className="w-full max-w-sm" open={open} onOpenChange={onOpenChange}>
      <CmpCard className="w-full">
        {/* The trigger renders its own Pressable and stands in for CmpCardHeader —
            slotting it onto the header instead would drop onPress, since the header
            is a plain View. Hence the header's px-6 repeated here. */}
        <CmpCollapsibleTrigger className="flex-row items-center gap-2 px-6">
          {/* flex-1 on the title, shrink-0 on the icon: without it the row squeezes a
              longer translation (Hindi "और विकल्प") down to its first word. */}
          <CmpCardTitle className="flex-1">{t('reminder.sectionMore')}</CmpCardTitle>
          {/* Swapping the glyph rather than rotating one: NativeWind's rotate-180
              makes the icon vanish here instead of flipping it. */}
          <CmpIcon
            as={open ? ChevronUpIcon : ChevronDownIcon}
            className="size-5 shrink-0 text-muted-foreground"
          />
        </CmpCollapsibleTrigger>
        <CmpCollapsibleContent>
          <CmpCardContent className="gap-4">
            <View className="gap-1.5">
              <CmpLabel nativeID="note">{t('reminder.noteLabel')}</CmpLabel>
              <CmpTextarea
                aria-labelledby="note"
                value={draft.note}
                onChangeText={(v) => update('note', v)}
                placeholder={t('reminder.notePlaceholder')}
                editable={editable}
              />
            </View>
            <View className="gap-1.5">
              <CmpLabel nativeID="tags">{t('reminder.tagsLabel')}</CmpLabel>
              <TagInput
                value={draft.tags}
                onChange={(v) => update('tags', v)}
                available={allTags}
                placeholder={t('reminder.tagsPlaceholder')}
                editable={editable}
              />
            </View>
            <View className="gap-1.5">
              <CmpLabel nativeID="priority">{t('reminder.priority')}</CmpLabel>
              <CmpSelect
                value={priorityOptions.find((o) => o.value === draft.priority)}
                onValueChange={(option) => {
                  if (option) update('priority', option.value);
                }}>
                <CmpSelectTrigger aria-labelledby="priority">
                  <CmpSelectValue placeholder={t('reminder.priority')} />
                </CmpSelectTrigger>
                <CmpSelectContent>
                  {priorityOptions.map((o) => (
                    <CmpSelectItem key={o.value} value={o.value} label={o.label} />
                  ))}
                </CmpSelectContent>
              </CmpSelect>
            </View>
          </CmpCardContent>
        </CmpCollapsibleContent>
      </CmpCard>
    </CmpCollapsible>
  );
}
