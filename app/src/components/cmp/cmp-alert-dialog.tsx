import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { ComponentProps } from 'react';

export type CmpAlertDialogProps = ComponentProps<typeof AlertDialog>;
export type CmpAlertDialogActionProps = ComponentProps<typeof AlertDialogAction>;
export type CmpAlertDialogCancelProps = ComponentProps<typeof AlertDialogCancel>;
export type CmpAlertDialogContentProps = ComponentProps<typeof AlertDialogContent>;
export type CmpAlertDialogDescriptionProps = ComponentProps<typeof AlertDialogDescription>;
export type CmpAlertDialogFooterProps = ComponentProps<typeof AlertDialogFooter>;
export type CmpAlertDialogHeaderProps = ComponentProps<typeof AlertDialogHeader>;
export type CmpAlertDialogTitleProps = ComponentProps<typeof AlertDialogTitle>;
export type CmpAlertDialogTriggerProps = ComponentProps<typeof AlertDialogTrigger>;

export function CmpAlertDialog(props: CmpAlertDialogProps) {
  return <AlertDialog {...props} />;
}

export function CmpAlertDialogAction(props: CmpAlertDialogActionProps) {
  return <AlertDialogAction {...props} />;
}

export function CmpAlertDialogCancel(props: CmpAlertDialogCancelProps) {
  return <AlertDialogCancel {...props} />;
}

export function CmpAlertDialogContent(props: CmpAlertDialogContentProps) {
  return <AlertDialogContent {...props} />;
}

export function CmpAlertDialogDescription(props: CmpAlertDialogDescriptionProps) {
  return <AlertDialogDescription {...props} />;
}

export function CmpAlertDialogFooter(props: CmpAlertDialogFooterProps) {
  return <AlertDialogFooter {...props} />;
}

export function CmpAlertDialogHeader(props: CmpAlertDialogHeaderProps) {
  return <AlertDialogHeader {...props} />;
}

export function CmpAlertDialogTitle(props: CmpAlertDialogTitleProps) {
  return <AlertDialogTitle {...props} />;
}

export function CmpAlertDialogTrigger(props: CmpAlertDialogTriggerProps) {
  return <AlertDialogTrigger {...props} />;
}
