import { Button, type ButtonProps } from '@/components/ui/button';

export type CmpButtonProps = ButtonProps;

export function CmpButton(props: CmpButtonProps) {
  return <Button {...props} />;
}
