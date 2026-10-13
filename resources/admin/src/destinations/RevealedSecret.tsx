import { useId, useRef, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { Copy, Info } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { GuideLink } from '../shell/GuideLink';
import type { DestinationType } from './api';

/**
 * **A generated secret, shown the one time it exists in the browser** (ADR
 * 0148): read-only, with Copy, and a note that this is the only time.
 *
 * Nothing waits on it. Done stays enabled — a merchant whose receiver ignores
 * signatures has no use for the secret, and blocking them until they copy it
 * would teach everyone to copy it somewhere unsafe. The field's own
 * `description` and `guide` come from the server, so free names no receiver.
 */
export function RevealedSecret({ type, revealed }: { type: DestinationType; revealed: Readonly<Record<string, string>> }) {
  return <>{Object.entries(revealed).map(([key, value]) => {
    const field = type.connection_schema?.[key];
    return <SecretField key={key} label={field?.label ?? key} value={value} description={field?.description} guide={field?.guide} />;
  })}</>;
}

function SecretField({ label, value, description, guide }: { label: string; value: string; description?: string; guide?: string }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');
  const run = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(value);
      setCopy('copied');
    } catch {
      // Selected, so Ctrl+C is one key away.
      setCopy('failed');
      input.current?.focus();
      input.current?.select();
    }
  };
  return <div className="flex min-w-0 flex-col gap-3">
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="wconvert-toolbar flex flex-wrap items-center gap-2">
        <Input ref={input} id={id} value={value} readOnly dir="ltr" className="min-w-0 flex-[1_1_14rem] font-mono"
          aria-describedby={`${id}-note`} onFocus={(event) => event.currentTarget.select()} />
        <Button type="button" variant="outline" onClick={() => void run()}>
          <Copy aria-hidden="true" />{copy === 'copied' ? __('Copied', 'wconvert') : __('Copy', 'wconvert')}
        </Button>
      </div>
      <p role="status" className="m-0 text-note empty:hidden">
        {copy === 'failed' ? __('Couldn’t copy. It is selected: press Ctrl+C or ⌘C.', 'wconvert') : ''}
      </p>
    </div>
    <div id={`${id}-note`} className="flex items-start gap-2 rounded-md bg-info-surface p-3 text-note text-foreground">
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info" />
      <p className="m-0">
        {__('This is the only time it is shown. Copy it into your own code now; if you lose it, regenerate a new one.', 'wconvert')}
        {description && <>{' '}{description}</>}
        {guide && <>{' '}<GuideLink href={guide}>{__('How to verify', 'wconvert')}</GuideLink></>}
      </p>
    </div>
  </div>;
}
