import { forwardRef, type ComponentProps } from 'react';
import { DialogContent, DialogHeader } from '../components/ui/dialog';
import { cn } from '../lib/utils';

/** One template dialog shell; callers retain navigation and focus ownership. */
export function PickerDialogContent({ className, ...props }: ComponentProps<typeof DialogContent>) {
  return <DialogContent className={cn('wconvert-picker gap-0 overflow-hidden p-0 sm:max-w-[80rem]', className)} {...props} />;
}

export function PickerDialogHeader({ className, ...props }: ComponentProps<typeof DialogHeader>) {
  return <DialogHeader className={cn('wconvert-picker__header text-start', className)} {...props} />;
}

/** This is the sole document scroll boundary, not the dialog or its footer. */
export const PickerDialogBody = forwardRef<HTMLDivElement, ComponentProps<'div'>>(function PickerDialogBody({ className, ...props }, ref) {
  return <div ref={ref} className={cn('wconvert-picker__body', className)} {...props} />;
});

export function PickerDialogFooter({ className, ...props }: ComponentProps<'footer'>) {
  return <footer className={cn('wconvert-picker__footer wconvert-toolbar', className)} {...props} />;
}
