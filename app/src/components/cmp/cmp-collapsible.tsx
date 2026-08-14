import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { ComponentProps } from 'react';

export type CmpCollapsibleProps = ComponentProps<typeof Collapsible>;
export type CmpCollapsibleContentProps = ComponentProps<typeof CollapsibleContent>;
export type CmpCollapsibleTriggerProps = ComponentProps<typeof CollapsibleTrigger>;

export function CmpCollapsible(props: CmpCollapsibleProps) {
  return <Collapsible {...props} />;
}

export function CmpCollapsibleContent(props: CmpCollapsibleContentProps) {
  return <CollapsibleContent {...props} />;
}

export function CmpCollapsibleTrigger(props: CmpCollapsibleTriggerProps) {
  return <CollapsibleTrigger {...props} />;
}
