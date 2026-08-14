import { ToggleGroup, ToggleGroupIcon, ToggleGroupItem } from '@/components/ui/toggle-group';
import * as React from 'react';

export type CmpToggleGroupProps = React.ComponentProps<typeof ToggleGroup>;
export type CmpToggleGroupItemProps = React.ComponentProps<typeof ToggleGroupItem>;

export function CmpToggleGroup(props: CmpToggleGroupProps) {
  return <ToggleGroup {...props} />;
}

export function CmpToggleGroupItem(props: CmpToggleGroupItemProps) {
  return <ToggleGroupItem {...props} />;
}

export function CmpToggleGroupIcon(props: React.ComponentProps<typeof ToggleGroupIcon>) {
  return <ToggleGroupIcon {...props} />;
}
