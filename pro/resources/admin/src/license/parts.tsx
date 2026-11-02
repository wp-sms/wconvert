import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { __ } from '@wordpress/i18n';
import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { refusable } from '@/lib/refusable';
import { Input } from '@/components/ui/input';
import { Field } from '@/shell/Field';

/**
 * A pasted key, cleaned: no spaces, every dash-like character a hyphen, upper
 * case. While typing (`full` false) a trailing hyphen stays, or the next group
 * could never be typed; the server tidies the ends again before it activates.
 */
export function cleanKey(raw: string, full = true): string {
  const key = raw.toUpperCase().replace(/\s+/g, '').replace(/[‐-―−﹘﹣－_]/g, '-');

  return full ? key.replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '') : key;
}

/**
 * A link to the store, which opens beside WordPress and says so. With no
 * address there is no door: `href="#"` opened a dead tab (§20).
 */
export function Ext({ href, children, variant }: { href: string | undefined; children: ReactNode; variant?: 'brand' | 'outline' | 'link' }) {
  if (!href) return null;

  const label = <>{children} <span aria-hidden="true" className="inline-block rtl:-scale-x-100">↗</span><span className="sr-only"> {__('(opens in a new tab)', 'wconvert-pro')}</span></>;

  if (variant === undefined || variant === 'link') {
    return <a className="wconvert-license-ext" href={href} target="_blank" rel="noreferrer">{label}</a>;
  }

  return <Button asChild variant={variant}><a href={href} target="_blank" rel="noreferrer">{label}</a></Button>;
}

/** Where to find a key, and the account's door to it where there is one. */
export function KeyHint({ account }: { account: string | undefined }) {
  return <>{__('It’s in your purchase email', 'wconvert-pro')}{account && <> · <Ext href={account}>{__('Find my key', 'wconvert-pro')}</Ext></>}</>;
}

export type ResultTone = 'success' | 'warning' | 'danger';

const RESULT = {
  success: { icon: CircleCheck, surface: 'border-success/30 bg-success-surface text-success' },
  warning: { icon: TriangleAlert, surface: 'border-warning/30 bg-warning-surface text-warning' },
  danger: { icon: CircleAlert, surface: 'border-destructive/30 bg-destructive-surface' },
} as const;

/**
 * A result, inline where it happened, in the shared `Alert` and never a toast
 * (ADR 0143): it is read and announced, and it stays until the next action
 * replaces it.
 *
 * `focus` is for an answer the merchant just asked for, and moves focus to it
 * when it ARRIVES, once; a new result is a new alert (give it a new `key`), so
 * re-rendering the same one never pulls focus back. A background refresh never
 * passes it: nobody asked for that check, and focus is where they left it.
 */
export function ResultAlert({ tone, title, children, focus = false }: { tone: ResultTone; title: string; children?: ReactNode; focus?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const { icon: Icon, surface } = RESULT[tone];

  useEffect(() => {
    if (focus) ref.current?.focus();
    // On arrival only: see above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Alert ref={ref} variant={tone === 'danger' ? 'destructive' : 'default'} role={tone === 'danger' ? 'alert' : 'status'} tabIndex={focus ? -1 : undefined}
      className={`wconvert-license-result ${surface}`}>
      <Icon aria-hidden="true" />
      <AlertTitle className="line-clamp-none">{title}</AlertTitle>
      {children && <AlertDescription>{children}</AlertDescription>}
    </Alert>
  );
}

/** A licence key field and its button, with the reason a submit was refused under it. */
export function KeyField({
  id, label, value, onChange, onSubmit, busy, submitLabel, error, hint, inputRef, refused = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  busy: boolean;
  submitLabel?: string;
  error?: ReactNode;
  hint?: ReactNode;
  inputRef?: RefObject<HTMLInputElement | null>;
  refused?: boolean;
}) {
  return (
    <form className="wconvert-license-keyfield" onSubmit={(event) => { event.preventDefault(); if (!busy && !refused) { onChange(cleanKey(value)); onSubmit(); } }}>
      <Field label={label} htmlFor={id} hint={hint} hintId={`${id}-hint`}>
        <div className="wconvert-license-keyrow">
          <Input
            id={id}
            ref={inputRef}
            className="wconvert-license-mono"
            value={value}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={error ? true : undefined}
            aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`}
            onChange={(event) => onChange(cleanKey(event.target.value, false))}
            placeholder="WCV-XXXX-XXXX-XXXX"
          />
          <Button type="submit" disabled={busy} {...refusable(refused ? `${id}-error` : null)}>
            {busy ? __('Activating…', 'wconvert-pro') : submitLabel ?? __('Activate', 'wconvert-pro')}
          </Button>
        </div>
      </Field>
      {error && <div id={`${id}-error`} className="wconvert-license-error">{error}</div>}
    </form>
  );
}
