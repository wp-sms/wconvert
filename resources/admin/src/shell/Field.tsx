import type { ReactNode } from 'react';
import { Label } from '../components/ui/label';
import { cn } from '../lib/utils';
import { Description } from './Description';

/**
 * **The one field layout** (ADR 0131): label above, 6px, the control, then a
 * `note` hint below and any error under that. Eight spacings had grown — 0, 5,
 * 6, 8 and 12px, label above and beside — and this is the Destinations form's,
 * kept because it was the one that read as a form.
 *
 * Pass the hint's id to the control's `aria-describedby` yourself; the field
 * does not clone its child.
 */
export function Field({
  label,
  htmlFor,
  hint,
  hintId,
  error,
  className,
  children,
}: {
  label: ReactNode;
  htmlFor: string;
  hint?: ReactNode;
  hintId?: string;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <Description id={hintId}>{hint}</Description>}
      {error && <p role="alert" className="m-0 text-note text-destructive">{error}</p>}
    </div>
  );
}
