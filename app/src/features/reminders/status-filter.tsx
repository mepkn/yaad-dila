import { CmpScrollView } from '@/components/cmp/cmp-scroll-view';
import { CmpText } from '@/components/cmp/cmp-text';
import { CmpToggleGroup, CmpToggleGroupItem } from '@/components/cmp/cmp-toggle-group';
import { REMINDER_STATUSES, type ReminderStatus } from '@/lib/reminders';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

// Status codes stay English; only the labels translate, so the map is keyed by
// code and resolved with t() at render (never a module-level translated const).
const STATUS_LABEL_KEYS: Record<ReminderStatus, string> = {
  all: 'reminders.statusAll',
  upcoming: 'reminders.statusUpcoming',
  paused: 'reminders.statusPaused',
  past: 'reminders.statusPast',
};

interface StatusFilterProps {
  value: ReminderStatus;
  onChange: (next: ReminderStatus) => void;
}

export function StatusFilter({ value, onChange }: StatusFilterProps) {
  const { t } = useTranslation();
  return (
    <CmpScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // CmpScrollView defaults to flex-1, which would make this row eat the
      // remaining height instead of hugging its content.
      className="grow-0"
      contentContainerClassName="gap-2 px-4">
      <CmpToggleGroup
        type="single"
        value={value}
        // The primitive emits undefined when the selected item is tapped again.
        // This is a filter, not a toggle — there is always exactly one active
        // bucket, so a deselect falls back to "all".
        onValueChange={(next) => onChange((next as ReminderStatus) ?? 'all')}
        variant="outline"
        size="sm"
        // shrink-0 so the row overflows into a horizontal scroll instead of
        // squeezing the items — RNR's item carries `min-w-0`, which otherwise
        // lets a longer label (Hindi "रुके हुए") truncate to fit.
        className="shrink-0 gap-2 rounded-none shadow-none">
        {REMINDER_STATUSES.map((status) => {
          const selected = value === status;
          return (
            <CmpToggleGroupItem
              key={status}
              value={status}
              // Undo the segmented-control look — RNR joins items into one bar
              // (rounded-none, border-l-0) — and override the selected fill:
              // the default `bg-accent` is nearly invisible on a light
              // background, which is fatal for the only cue of what is filtered.
              // The primitive supplies radio semantics (role + checked) itself.
              className={cn(
                'shrink-0 rounded-full border-l px-3',
                selected && 'border-primary bg-primary'
              )}>
              <CmpText
                numberOfLines={1}
                className={cn('shrink-0', selected && 'text-primary-foreground')}>
                {t(STATUS_LABEL_KEYS[status])}
              </CmpText>
            </CmpToggleGroupItem>
          );
        })}
      </CmpToggleGroup>
    </CmpScrollView>
  );
}
