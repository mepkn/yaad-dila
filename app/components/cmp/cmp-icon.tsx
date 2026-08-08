import { Icon } from '@/components/ui/icon';
import type { ComponentProps } from 'react';

export type CmpIconProps = ComponentProps<typeof Icon>;

export function CmpIcon(props: CmpIconProps) {
  return <Icon {...props} />;
}
