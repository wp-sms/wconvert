import { useId, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { adminSettings } from '../settings';

export interface PlacementGuidanceProps {
  readonly optinId: string;
  readonly optinName?: string;
  readonly displayType: string;
  /** A published version exists; this does not assert that it can show on any page. */
  readonly published: boolean;
}

/** Kept in parity with InlineOptinShortcode::TAG by the placement contract test. */
export function inlineShortcode(optinId: string): string {
  return `[wconvert_optin id="${optinId}"]`;
}

/** Open the existing real-page inspector, using WordPress's subdirectory-aware home URL. */
export function siteCheckUrl(homeUrl?: string, inspectParam?: string): string | null {
  if (!homeUrl || !inspectParam) return null;
  try {
    const target = new URL(homeUrl);
    if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) return null;
    target.searchParams.set(inspectParam, '1');
    return target.toString();
  } catch {
    return null;
  }
}

/** Placement instructions shared by draft review and the result of publishing. */
export function PlacementGuidance({ optinId, optinName, displayType, published }: PlacementGuidanceProps) {
  const id = useId();
  const inline = displayType === 'inline';
  const settings = adminSettings();
  const siteCheck = published ? siteCheckUrl(settings?.homeUrl, settings?.inspectParam) : null;

  return (
    <section className="wconvert-placement" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>{inline ? __('Place this Optin on a page', 'wconvert') : __('Check where it appears', 'wconvert')}</h3>
      {inline ? (
        <>
          {!published && <p>{__('Publish this Optin first so it becomes available in the page editor.', 'wconvert')}</p>}
          <ol className="wconvert-placement__steps">
            <li>{__('Edit the page or post where you want the form to appear.', 'wconvert')}</li>
            <li>{optinName
              ? sprintf(/* translators: %s: the Optin name in the page editor's picker. */ __('Add the “Inline Optin” block and choose “%s”.', 'wconvert'), optinName)
              : __('Add the “Inline Optin” block and select this Optin by its name.', 'wconvert')}</li>
            <li>{__('Update the page, then open it on your site to check the placement.', 'wconvert')}</li>
          </ol>
          <Shortcode optinId={optinId} />
          <p className="text-note text-muted-foreground">
            {__('The block or shortcode places it on the page. Its display rules, schedule and visitor settings still decide whether it appears.', 'wconvert')}
          </p>
        </>
      ) : (
        <p>{published
          ? __('Your published version can appear on pages that match its display rules. Its schedule, triggers and visitor settings still decide when it shows.', 'wconvert')
          : __('After publishing, this Optin can appear on pages that match its display rules. Its schedule, triggers and visitor settings decide when it shows.', 'wconvert')}</p>
      )}
      {siteCheck !== null && (
        <div className="wconvert-placement__check">
          <Button asChild variant="outline" size="sm">
            <a href={siteCheck} target="_blank" rel="noopener noreferrer" aria-describedby={`${id}-check-note`}>
              {__('Check your homepage', 'wconvert')}<ExternalLink aria-hidden="true" />
            </a>
          </Button>
          <p id={`${id}-check-note`} className="text-note text-muted-foreground">
            {__('Opens display checks for the published version in your signed-in session. It does not show draft edits or simulate a signed-out visitor.', 'wconvert')}
            {inline && <> {__('For an inline form, also check the page where you placed its block or shortcode.', 'wconvert')}</>}
          </p>
        </div>
      )}
      {!published && <p className="text-note text-muted-foreground">{__('The editor preview shows your draft. Check the actual page after publishing.', 'wconvert')}</p>}
    </section>
  );
}

function Shortcode({ optinId }: { readonly optinId: string }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const value = inlineShortcode(optinId);
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
      // A refused clipboard request still leaves an ordinary manual-copy path.
      if (input.current?.value === value) {
        input.current.focus();
        input.current.select();
      }
    }
  };

  return (
    <div className="wconvert-placement__embed">
      <label htmlFor={id}>{__('Shortcode for other editors', 'wconvert')}</label>
      <p id={`${id}-help`} className="text-note text-muted-foreground">
        {__('Use a Shortcode block or your page builder’s shortcode element.', 'wconvert')}
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
    </div>
  );
}
