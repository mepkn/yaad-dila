import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ComponentProps } from 'react';

export type CmpCardProps = ComponentProps<typeof Card>;
export type CmpCardContentProps = ComponentProps<typeof CardContent>;
export type CmpCardHeaderProps = ComponentProps<typeof CardHeader>;
export type CmpCardTitleProps = ComponentProps<typeof CardTitle>;

export function CmpCard(props: CmpCardProps) {
  return <Card {...props} />;
}

export function CmpCardContent(props: CmpCardContentProps) {
  return <CardContent {...props} />;
}

export function CmpCardHeader(props: CmpCardHeaderProps) {
  return <CardHeader {...props} />;
}

export function CmpCardTitle(props: CmpCardTitleProps) {
  return <CardTitle {...props} />;
}
