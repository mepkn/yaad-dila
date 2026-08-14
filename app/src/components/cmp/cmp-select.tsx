import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ComponentProps } from 'react';

export type CmpSelectProps = ComponentProps<typeof Select>;
export type CmpSelectContentProps = ComponentProps<typeof SelectContent>;
export type CmpSelectItemProps = ComponentProps<typeof SelectItem>;
export type CmpSelectTriggerProps = ComponentProps<typeof SelectTrigger>;
export type CmpSelectValueProps = ComponentProps<typeof SelectValue>;

export function CmpSelect(props: CmpSelectProps) {
  return <Select {...props} />;
}

export function CmpSelectContent(props: CmpSelectContentProps) {
  return <SelectContent {...props} />;
}

export function CmpSelectItem(props: CmpSelectItemProps) {
  return <SelectItem {...props} />;
}

export function CmpSelectTrigger(props: CmpSelectTriggerProps) {
  return <SelectTrigger {...props} />;
}

export function CmpSelectValue(props: CmpSelectValueProps) {
  return <SelectValue {...props} />;
}
