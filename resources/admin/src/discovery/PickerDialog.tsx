import { forwardRef, type ComponentProps } from 'react';
import { DialogHeader } from '../components/ui/dialog';
import { AdminDialogBody, AdminDialogContent } from '../components/ui/admin-dialog';
import { cn } from '../lib/utils';

/**
 * The template pickers on the shared modal (ADR 0131): a Large `AdminDialog`
 * at a fixed height, so filters and pagination stay put while the gallery
 * scrolls. Callers retain navigation and focus ownership.
 */
export function PickerDialogContent({ className, ...props }: ComponentProps<typeof AdminDialogContent>) {
  return <AdminDialogContent size="lg" className={cn('wconvert-picker', className)} {...props} />;
}

/** A picker's header also carries its toolbar, so it takes children rather than `AdminDialogHeader`'s slots. */
export function PickerDialogHeader({ className, ...props }: ComponentProps<typeof DialogHeader>) {
  return <DialogHeader className={cn('wconvert-picker__header text-start', className)} {...props} />;
}

/** This is the sole document scroll boundary, not the dialog or its footer. */
export const PickerDialogBody = forwardRef<HTMLDivElement, ComponentProps<'div'>>(function PickerDialogBody({ className, ...props }, ref) {
  return <AdminDialogBody ref={ref} className={cn('wconvert-picker__body', className)} {...props} />;
});

export function PickerDialogFooter({ className, ...props }: ComponentProps<'footer'>) {
  return <footer className={cn('wconvert-picker__footer wconvert-toolbar', className)} {...props} />;
}
