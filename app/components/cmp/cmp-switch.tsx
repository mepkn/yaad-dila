import { Switch } from '@/components/ui/switch';
import type { ComponentProps } from 'react';

export type CmpSwitchProps = ComponentProps<typeof Switch>;

export function CmpSwitch(props: CmpSwitchProps) {
  return <Switch {...props} />;
}
