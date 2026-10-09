import { forwardRef, useEffect, useId, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { XIcon } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { Button } from './button';
import { DialogClose, DialogContent, DialogDescription, DialogTitle } from './dialog';
import { cn } from '../../lib/utils';

/**
 * **The one modal layout, in three sizes** (ADR 0131, GUIDELINES §9).
 *
 * - Header: the title is the subject itself, an optional status badge, and one
 *   muted meta line.
 * - Body: the only part that scrolls.
 * - Footer: fixed. Back or Cancel at the start, an optional short note, the
 *   primary action at the end, and an error beside the actions.
 *
 * Small (32rem) is for confirms and short forms, Medium (48rem) for details,
 * Large (80rem) for pickers, the journey and preview. Template pickers grew the
 * layout first (`discovery/PickerDialog.tsx`, now aliases of this); about
 * twenty-five other dialogs each grew their own before this existed.
 */
export type AdminDialogSize = 'sm' | 'md' | 'lg';

// Utilities, not stylesheet rules: the vendored content's `grid` and
// `sm:max-w-lg` are layered `!important` utilities, which no unlayered rule
// can beat, so the size is merged over them here.
const SIZE: Record<AdminDialogSize, string> = { sm: 'sm:max-w-[32rem]', md: 'sm:max-w-[48rem]', lg: 'sm:max-w-[80rem]' };

/**
 * `dirty` is the one place a dialog asks before throwing typed input away.
 * Escape, an outside click and ✕ ask "Discard changes?" only when something
 * was typed; otherwise they close as usual. The question is drawn inside the
 * dialog, over its footer, because a dialog never stacks another (§9).
 */
export function AdminDialogContent({
  size = 'md',
  dirty = false,
  showCloseButton = true,
  className,
  children,
  onEscapeKeyDown,
  onPointerDownOutside,
  onInteractOutside,
  ...props
}: ComponentProps<typeof DialogContent> & { size?: AdminDialogSize; dirty?: boolean }) {
  const [asking, setAsking] = useState(false);
  const keep = useRef<HTMLButtonElement>(null);
  const question = useId();

  useEffect(() => {
    if (!dirty) setAsking(false);
  }, [dirty]);
  useEffect(() => {
    if (asking) keep.current?.focus();
  }, [asking]);

  return (
    <DialogContent
      showCloseButton={false}
      data-size={size}
      className={cn('wconvert-dialog flex flex-col gap-0 overflow-hidden p-0', SIZE[size], className)}
      onEscapeKeyDown={(event) => {
        onEscapeKeyDown?.(event);
        if (event.defaultPrevented || !dirty) return;
        event.preventDefault();
        setAsking((current) => !current);
      }}
      onPointerDownOutside={(event) => {
        onPointerDownOutside?.(event);
        if (event.defaultPrevented || !dirty) return;
        event.preventDefault();
        setAsking(true);
      }}
      onInteractOutside={(event) => {
        onInteractOutside?.(event);
        if (dirty) event.preventDefault();
      }}
      {...props}
    >
      {children}
      {!showCloseButton ? null : dirty ? (
        <button type="button" className="wconvert-dialog__close" onClick={() => setAsking(true)}>
          <XIcon aria-hidden="true" />
          <span className="sr-only">{__('Close', 'wconvert')}</span>
        </button>
      ) : (
        <DialogPrimitive.Close data-slot="dialog-close" className="wconvert-dialog__close">
          <XIcon aria-hidden="true" />
          <span className="sr-only">{__('Close', 'wconvert')}</span>
        </DialogPrimitive.Close>
      )}
      {asking && (
        <div role="group" aria-labelledby={question} className="wconvert-dialog__discard wconvert-toolbar">
          <p id={question}>{__('Discard changes?', 'wconvert')}</p>
          <Button ref={keep} type="button" variant="outline" onClick={() => setAsking(false)}>
            {__('Keep editing', 'wconvert')}
          </Button>
          <DialogClose asChild>
            <Button type="button">{__('Discard', 'wconvert')}</Button>
          </DialogClose>
        </div>
      )}
    </DialogContent>
  );
}

/**
 * The title is the subject — a person, a campaign, a design — never a verb
 * phrase about the dialog. `meta` is one muted line under it and is the
 * dialog's accessible description; `children` is anything the header must
 * also hold (a picker's toolbar, a stage control).
 */
export function AdminDialogHeader({
  title,
  badge,
  meta,
  className,
  children,
}: {
  title: ReactNode;
  badge?: ReactNode;
  meta?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div data-slot="dialog-header" className={cn('wconvert-dialog__header', className)}>
      <div className="wconvert-dialog__identity">
        <DialogTitle className="wconvert-dialog__title leading-snug" title={typeof title === 'string' ? title : undefined}>
          {title}
        </DialogTitle>
        {badge}
      </div>
      {meta && <DialogDescription className="wconvert-dialog__meta">{meta}</DialogDescription>}
      {children}
    </div>
  );
}

/** The sole scroll boundary — not the dialog, and not its footer. */
export const AdminDialogBody = forwardRef<HTMLDivElement, ComponentProps<'div'>>(function AdminDialogBody(
  { className, ...props },
  ref,
) {
  return <div ref={ref} className={cn('wconvert-dialog__body', className)} {...props} />;
});

/**
 * `back` sits at the start (Back, or Cancel). `note` is one short line. An
 * `error` sits beside the actions it is about, never at the top of the body.
 * `children` is the action group at the end, primary last.
 */
export function AdminDialogFooter({
  back,
  note,
  error,
  className,
  children,
}: {
  back?: ReactNode;
  note?: ReactNode;
  error?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <footer className={cn('wconvert-dialog__footer wconvert-toolbar', className)}>
      {back && <div className="wconvert-dialog__back">{back}</div>}
      <div className="wconvert-dialog__note">{note}</div>
      {error && (
        <p role="alert" className="wconvert-dialog__error">
          {error}
        </p>
      )}
      {children && <div className="wconvert-dialog__actions">{children}</div>}
    </footer>
  );
}

export { Dialog as AdminDialog, DialogTrigger as AdminDialogTrigger, DialogClose as AdminDialogClose } from './dialog';
