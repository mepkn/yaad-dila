import { Label } from '@/components/ui/label';
import type { ComponentProps } from 'react';

export type CmpLabelProps = ComponentProps<typeof Label>;

export function CmpLabel(props: CmpLabelProps) {
  return <Label {...props} />;
}
