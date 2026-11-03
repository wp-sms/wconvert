import type { ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Label } from '../components/ui/label';
import { cn } from '../lib/utils';
import { Description } from './Description';
import { InfoTip } from './InfoTip';

/**
 * **The one field layout** (ADR 0131): label above, 6px, the control, then a
 * `note` hint below and any error under that. Eight spacings had grown — 0, 5,
 * 6, 8 and 12px, label above and beside — and this is the Destinations form's,
 * kept because it was the one that read as a form.
 *
 * Pass the hint's id to the control's `aria-describedby` yourself; the field
 * does not clone its child.
 *
 * `tip` stands beside the label, outside it, because a button inside a label is
 * a button that also focuses the control (ADR 0187).
 */
export function Field({
  label,
  htmlFor,
  hint,
  hintId,
  tip,
  error,
  className,
  children,
}: {
  label: ReactNode;
  htmlFor: string;
  hint?: ReactNode;
  hintId?: string;
  tip?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      {tip === undefined ? <Label htmlFor={htmlFor}>{label}</Label> : (
        <span className="flex items-center gap-1">
          <Label htmlFor={htmlFor}>{label}</Label>
          <InfoTip label={typeof label === 'string' ? sprintf(/* translators: %s: a field label, e.g. “Answer type”. */ __('About %s', 'wconvert'), label) : __('About this field', 'wconvert')}>{tip}</InfoTip>
        </span>
      )}
      {children}
      {hint && <Description id={hintId}>{hint}</Description>}
      {error && <p role="alert" className="m-0 text-note text-destructive">{error}</p>}
    </div>
  );
}
