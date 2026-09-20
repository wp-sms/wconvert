import { useId, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { Button } from '@/components/ui/button';
import { Preview } from '@/builder/Preview';
import type { InlinePlacementProps } from '@/inlinePlacement';
import type { Template } from '@renderer/types';

export default function LockSettings({ optinId, published, config }: InlinePlacementProps) {
  const id = useId();
  const [state, setState] = useState('locked');
  const template = config.template as Template | undefined;
  return <div className="wconvert-inline-placement">
    <p>{__('Show the selected content after a successful form submission. Access is remembered for this Campaign in the same browser for 30 days. If the form cannot work, the content stays available.', 'wconvert')}</p>
    <p>{__('Use the WConvert Content lock block in your post or page, and put the content to reveal inside it. Keep a public introduction outside. Use one locked region per page.', 'wconvert')}</p>
    {published ? <p>{__('In the classic editor, wrap a complete region with:', 'wconvert')} <code>{`[wconvert_content_lock id="${optinId}"]…[/wconvert_content_lock]`}</code></p>
      : <p>{__('Publish this Campaign before selecting it in the content block.', 'wconvert')}</p>}
    <p>{__('The content is delivered in the page and direct file links remain public. Use this for promotional bonuses, not private files or paid membership access.', 'wconvert')}</p>
    <p>{__('Display rules and frequency limits can leave the content available without a form. Existing subscribers on another device are not recognized.', 'wconvert')}</p>
    <label htmlFor={id}>{__('Preview content lock', 'wconvert')}</label>
    <select id={id} value={state} onChange={event => setState(event.target.value)}>
      <option value="locked">{__('Locked', 'wconvert')}</option>
      <option value="unlocked">{__('Unlocked', 'wconvert')}</option>
      <option value="unavailable">{__('Form unavailable', 'wconvert')}</option>
    </select>
    <div className="rounded border p-4" aria-label={__('Content lock example', 'wconvert')}>
      <p>{__('Public introduction — explain what readers will receive.', 'wconvert')}</p>
      {template && state !== 'unavailable' && <Preview template={template} step={state === 'locked' ? 0 : template.tree.steps.length - 1} />}
      {state === 'locked' ? <p>{__('The selected content is hidden here until submission.', 'wconvert')}</p> : <p>{__('Your bonus content — this region is now readable.', 'wconvert')}</p>}
      {state === 'unavailable' && <p>{__('No successful submission is recorded for this fallback.', 'wconvert')}</p>}
    </div>
    <Button variant="outline" onClick={() => window.open('https://developers.google.com/search/docs/appearance/structured-data/paywalled-content', '_blank', 'noopener,noreferrer')}>{__('Read Google’s gated-content guidance', 'wconvert')}</Button>
  </div>;
}
