import { Textarea } from '@/components/ui/textarea';
import type { ComponentProps } from 'react';

export type CmpTextareaProps = ComponentProps<typeof Textarea>;

export function CmpTextarea(props: CmpTextareaProps) {
  return <Textarea {...props} />;
}
