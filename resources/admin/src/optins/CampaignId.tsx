import { useId, useRef, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { Copy } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

/** A row's existing ID, available even when the asynchronous details fail. */
export function CampaignId({ value, variant }: { value: string; variant: boolean }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle' | 'copying' | 'copied' | 'failed'>('idle');
  const copy = async () => {
    setStatus('copying');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(value);
      setStatus('copied');
    } catch {
      setStatus('failed');
      input.current?.focus(); input.current?.select();
    }
  };
  return <div className="grid gap-2">
    <label htmlFor={id}>{variant ? __('Variant ID', 'wconvert') : __('Campaign ID', 'wconvert')}</label>
    <div className="flex flex-wrap gap-2">
      <Input id={id} ref={input} value={value} readOnly className="min-w-0 flex-[1_1_14rem] font-mono" dir="ltr"
        aria-describedby={`${id}-help`} onFocus={event => event.currentTarget.select()} />
      <Button type="button" variant="outline" size="sm" disabled={status === 'copying'} onClick={() => { void copy(); }}>
        <Copy aria-hidden="true" />{variant ? __('Copy variant ID', 'wconvert') : __('Copy campaign ID', 'wconvert')}
      </Button>
    </div>
    <p id={`${id}-help`} className="m-0 text-note text-muted-foreground">
      {variant ? __('Use this ID to match this variant in JavaScript events. Use the parent Campaign’s ID to match all its active variants.', 'wconvert')
        : __('Use this ID to match this Campaign in JavaScript events.', 'wconvert')}
    </p>
    {status === 'copied' && <p role="status" className="m-0 text-note">{__('ID copied.', 'wconvert')}</p>}
    {status === 'failed' && <p role="alert" className="m-0 text-note">{__('Could not copy automatically. The ID is selected; copy it with your keyboard or context menu.', 'wconvert')}</p>}
  </div>;
}
