import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { ComponentProps } from 'react';

export type CmpDialogProps = ComponentProps<typeof Dialog>;
export type CmpDialogCloseProps = ComponentProps<typeof DialogClose>;
export type CmpDialogContentProps = ComponentProps<typeof DialogContent>;
export type CmpDialogDescriptionProps = ComponentProps<typeof DialogDescription>;
export type CmpDialogFooterProps = ComponentProps<typeof DialogFooter>;
export type CmpDialogHeaderProps = ComponentProps<typeof DialogHeader>;
export type CmpDialogTitleProps = ComponentProps<typeof DialogTitle>;
export type CmpDialogTriggerProps = ComponentProps<typeof DialogTrigger>;

export function CmpDialog(props: CmpDialogProps) {
  return <Dialog {...props} />;
}

export function CmpDialogClose(props: CmpDialogCloseProps) {
  return <DialogClose {...props} />;
}

export function CmpDialogContent(props: CmpDialogContentProps) {
  return <DialogContent {...props} />;
}

export function CmpDialogDescription(props: CmpDialogDescriptionProps) {
  return <DialogDescription {...props} />;
}

export function CmpDialogFooter(props: CmpDialogFooterProps) {
  return <DialogFooter {...props} />;
}

export function CmpDialogHeader(props: CmpDialogHeaderProps) {
  return <DialogHeader {...props} />;
}

export function CmpDialogTitle(props: CmpDialogTitleProps) {
  return <DialogTitle {...props} />;
}

export function CmpDialogTrigger(props: CmpDialogTriggerProps) {
  return <DialogTrigger {...props} />;
}
