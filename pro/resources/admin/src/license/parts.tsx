import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { __ } from '@wordpress/i18n';
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

/** A link to the store, which opens beside WordPress and says so. */
export function Ext({ href, children, variant, size }: { href: string; children: ReactNode; variant?: 'brand' | 'outline' | 'link'; size?: 'sm' }) {
  const label = <>{children} <span aria-hidden="true">↗</span><span className="sr-only"> {__('(opens in a new tab)', 'wconvert-pro')}</span></>;

  if (variant === undefined || variant === 'link') {
    return <a className="wconvert-license-ext" href={href} target="_blank" rel="noreferrer">{label}</a>;
  }

  return <Button asChild variant={variant} size={size}><a href={href} target="_blank" rel="noreferrer">{label}</a></Button>;
}

export type NoticeTone = 'success' | 'info' | 'warning' | 'danger';

const NOTICE_ICON = { success: CircleCheck, info: Info, warning: TriangleAlert, danger: CircleAlert } as const;

/**
 * A result, inline where it happened — never a toast (ADR 0143): it is read,
 * focused and announced, and it stays until the next action replaces it.
 * Focus moves to it when it ARRIVES, once; a new result is a new notice (give
 * it a new `key`), so re-rendering the same one never pulls focus back.
 */
export function Notice({ tone, title, children, actions, focus = false }: { tone: NoticeTone; title?: string; children?: ReactNode; actions?: ReactNode; focus?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const Icon = NOTICE_ICON[tone];

  useEffect(() => {
    if (focus) ref.current?.focus();
    // On arrival only: see above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={ref} className="wconvert-license-notice" data-tone={tone} role={tone === 'danger' ? 'alert' : 'status'} tabIndex={-1}>
      <Icon aria-hidden="true" />
      <div>
        {title && <p className="wconvert-license-notice__title">{title}</p>}
        {children && <div className="wconvert-license-notice__body">{children}</div>}
        {actions && <div className="wconvert-license-actions">{actions}</div>}
      </div>
    </div>
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
          <Button type="submit" aria-disabled={busy || refused ? true : undefined}>
            {busy ? __('Activating…', 'wconvert-pro') : submitLabel ?? __('Activate', 'wconvert-pro')}
          </Button>
        </div>
      </Field>
      {error && <div id={`${id}-error`} className="wconvert-license-error">{error}</div>}
    </form>
  );
}
