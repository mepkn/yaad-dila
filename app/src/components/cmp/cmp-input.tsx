import { Input } from '@/components/ui/input';
import type { ComponentProps } from 'react';

export type CmpInputProps = ComponentProps<typeof Input>;

export function CmpInput(props: CmpInputProps) {
  return <Input {...props} />;
}
