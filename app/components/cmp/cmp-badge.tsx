import { Badge, type BadgeProps } from '@/components/ui/badge';

export type CmpBadgeProps = BadgeProps;

export function CmpBadge(props: CmpBadgeProps) {
  return <Badge {...props} />;
}
