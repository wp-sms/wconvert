import type { ReactNode, RefObject } from 'react';
import { __ } from '@wordpress/i18n';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';

/**
 * A consequential decision, destructive by default. Publication passes the
 * primary variant: changing what visitors can see deserves confirmation,
 * without implying that publishing destroys a campaign.
 *
 * **Nothing in this admin confirmed anything** until ADR 0039 — no `confirm(`,
 * no dialog, no "are you sure" anywhere in `resources/admin/src/`. That included
 * the retention radio, where one click schedules cron deletion of every [[Lead]]
 * older than 90 days, and the Delete beside Publish on the Optin list, which are
 * two buttons the same size in the same row.
 *
 * **It is CONTROLLED, and that is not a style preference.** The obvious shape is
 * a trigger inside the component that opens it — but the Optin list's Delete
 * lives inside a `DropdownMenu`, and a menu closes on select and unmounts
 * everything under it, taking the dialog with it before it can open. Hoisting
 * the open state to the row is the fix, and a controlled dialog is what makes
 * that expressible.
 *
 * **The confirm button names the outcome**, never "OK" — a merchant reading
 * "Delete Welcome discount" on the button has been told what pressing it does
 * without having to have read the sentence above it. It is `destructive` by
 * default because that is what this component is for; the safe way out is the
 * cancel, and it is the one focus lands on.
 *
 * Radix supplies the focus trap, Esc-to-close and the ARIA (ADR 0036). What is
 * left is the words, and the words are the part that matters.
 *
 * **`returnFocusTo` is the one thing Radix cannot supply here**, and it was
 * found in a browser rather than reasoned about: a triggerless dialog has
 * nothing to restore focus to, so closing either of this admin's confirms left
 * the caret on `<body>` and a keyboard merchant back at the top of the
 * document. Radix restores to the `AlertDialogTrigger` it rendered, and this
 * component deliberately has none — the Optin list's Delete lives inside a
 * `DropdownMenu`, which unmounts a trigger under it before it can open. So the
 * caller names the control that opened it, and this puts the caret back.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  variant = 'destructive',
  cancelLabel,
  onConfirm,
  returnFocusTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  variant?: 'default' | 'destructive';
  cancelLabel?: string;
  onConfirm: () => void;
  returnFocusTo?: RefObject<HTMLElement | null>;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          const node = returnFocusTo?.current;

          if (node !== null && node !== undefined) {
            event.preventDefault();
            node.focus();
          }
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel ?? __('Cancel', 'wconvert')}</AlertDialogCancel>
          <AlertDialogAction variant={variant} onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
