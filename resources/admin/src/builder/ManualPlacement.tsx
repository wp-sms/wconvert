import { useId, useRef, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { adminSettings } from '../settings';

/** Kept in parity with InlineOptinShortcode::TAG by the placement contract test. */
export function inlineShortcode(optinId: string): string {
  return `[wconvert_optin id="${optinId}"]`;
}

/** The manual placement instructions shared by Free and every paid tier. */
export function ManualPlacement({ optinId, published }: { readonly optinId: string; readonly published: boolean }) {
  const destination = adminSettings()?.placementEditor;
  const blockTheme = destination?.type === 'site_editor';
  const widgets = destination?.type === 'widgets';

  return <div className="wconvert-manual-placement">
    {!published && <p>{__('Publish this Campaign first so it becomes available in WordPress editors.', 'wconvert')}</p>}
    <p>{__('Add the “Inline Campaign” block where you want the form to appear.', 'wconvert')}</p>
    {blockTheme && <p>{__('For a shared sidebar or footer, edit the template or template part that owns that area.', 'wconvert')}</p>}
    {widgets && <p>{__('Choose a sidebar or footer area supplied by your theme. If it uses classic widgets, add a Text widget and paste the shortcode below.', 'wconvert')}</p>}
    {destination && <Button asChild variant="outline" size="sm">
      <a href={destination.url} target="_blank" rel="noopener noreferrer">
        {blockTheme ? __('Open Site Editor', 'wconvert') : __('Open Widgets', 'wconvert')}
        <ExternalLink aria-hidden="true" />
      </a>
    </Button>}
    <Shortcode optinId={optinId} />
    <p className="text-note text-muted-foreground">
      {__('The theme controls which site-wide areas exist. Display rules, schedule and visitor settings still decide whether this Campaign appears.', 'wconvert')}
    </p>
  </div>;
}

/** One selectable shortcode with an accessible clipboard fallback. */
export function Shortcode({ optinId }: { readonly optinId: string }) {
  return <ShortcodeCopy value={inlineShortcode(optinId)} label={__('Shortcode for other editors', 'wconvert')} help={__('Use a Shortcode block, a classic Text widget, or your page builder’s shortcode element.', 'wconvert')} />;
}

export function ShortcodeCopy({ value, label, help }: { value: string; label: string; help: string }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<{ value: string; status: 'copying' | 'copied' | 'failed' } | null>(null);
  const status = result?.value === value ? result.status : null;

  const copy = async () => {
    setResult({ value, status: 'copying' });
    try {
      if (navigator.clipboard?.writeText === undefined) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(value);
      setResult({ value, status: 'copied' });
    } catch {
      setResult({ value, status: 'failed' });
      if (input.current?.value === value) {
        input.current.focus();
        input.current.select();
      }
    }
  };

  return <div className="wconvert-placement__embed">
    <label htmlFor={id}>{label}</label>
    <p id={`${id}-help`} className="text-note text-muted-foreground">
      {help}
    </p>
    <div className="wconvert-placement__copy">
      <Input ref={input} id={id} value={value} readOnly aria-describedby={`${id}-help`}
        className="wconvert-placement__shortcode font-mono" onFocus={(event) => event.currentTarget.select()} />
      <Button type="button" variant="outline" size="sm" disabled={status === 'copying'} onClick={() => { void copy(); }}>
        {status === 'copied' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {status === 'copied' ? __('Copied', 'wconvert') : __('Copy shortcode', 'wconvert')}
      </Button>
    </div>
    {status === 'copied' && <p role="status" className="text-note">{__('Shortcode copied.', 'wconvert')}</p>}
    {status === 'failed' && <p role="alert" className="text-note">{__('Could not copy automatically. The shortcode is selected; copy it with your keyboard or context menu.', 'wconvert')}</p>}
  </div>;
}
