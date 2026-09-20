import { __ } from '@wordpress/i18n';
import type { InlinePlacementProps } from '@/inlinePlacement';
import { ShortcodeCopy } from '@/builder/ManualPlacement';

export default function LockSettings({ optinId, published }: InlinePlacementProps) {
  const shortcode = `[wconvert_content_lock id="${optinId}"]…[/wconvert_content_lock]`;
  return <div className="wconvert-inline-placement">
    <p>{published
      ? __('Add a WConvert Lock from here divider to your article. Choose this Campaign and update the page.', 'wconvert')
      : __('Publish this Campaign, then add a WConvert Lock from here divider to your article.', 'wconvert')}</p>
    <p>{__('Content stays readable if the form is unavailable. Private content is not protected.', 'wconvert')}</p>
    <details className="wconvert-placement-help">
      <summary>{__('Setup details', 'wconvert')}</summary>
      <p>{__('Use one lock per page. The divider covers the rest of the article. To lock only a bonus section, use the WConvert Content lock block.', 'wconvert')}</p>
      <p>{__('Access is remembered for 30 days in this browser. Display rules and frequency limits still apply.', 'wconvert')}</p>
      {published && <ShortcodeCopy value={shortcode} label={__('Classic editor shortcode', 'wconvert')} help={__('Replace the ellipsis with your content. Keep both shortcode tags around the complete region.', 'wconvert')} />}
      <p>{__('Page HTML and file links remain public.', 'wconvert')}</p>
    </details>
  </div>;
}
