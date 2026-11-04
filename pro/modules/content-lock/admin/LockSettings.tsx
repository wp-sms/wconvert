import { __ } from '@wordpress/i18n';
import type { InlinePlacementProps } from '@/inlinePlacementSlots';
import { ShortcodeCopy } from '@/builder/ManualPlacement';

/**
 * Content lock, set up — the same settings card as Manual placement, with
 * every fact on show. Nothing here hides behind a disclosure: there are only
 * a few lines, and each changes what the merchant does next (ADR 0042).
 */
export default function LockSettings({ optinId, published }: InlinePlacementProps) {
  const shortcode = `[wconvert_content_lock id="${optinId}"]…[/wconvert_content_lock]`;
  return <div className="wconvert-placement-panel">
    {!published && <p className="wconvert-display-hint" data-attention="true">{__('Publish this campaign first. The lock only finds published campaigns.', 'wconvert-pro')}</p>}
    <div className="wconvert-display-settings">
      <div className="wconvert-placement-row">
        <div className="wconvert-placement-row__text">
          <p className="wconvert-placement-row__title">{__('Lock the rest of an article', 'wconvert-pro')}</p>
          <p className="wconvert-display-hint">{__('Add the “WConvert lock from here” divider, then choose this campaign.', 'wconvert-pro')}</p>
        </div>
      </div>
      <div className="wconvert-placement-row">
        <div className="wconvert-placement-row__text">
          <p className="wconvert-placement-row__title">{__('Lock one section', 'wconvert-pro')}</p>
          <p className="wconvert-display-hint">{__('Wrap just that section in the “WConvert content lock” block instead.', 'wconvert-pro')}</p>
        </div>
      </div>
      {published && <div className="wconvert-placement-row">
        <ShortcodeCopy value={shortcode} label={__('Classic editor shortcode', 'wconvert-pro')} help={__('Replace the ellipsis with the section. Keep both shortcode tags around it.', 'wconvert-pro')} />
      </div>}
    </div>
    <ul className="wconvert-placement-facts">
      <li>{__('Visitors who sign up keep access for 30 days in this browser.', 'wconvert-pro')}</li>
      <li>{__('If the form can’t load, the content stays readable.', 'wconvert-pro')}</li>
      <li>{__('Page HTML and file links stay public, so don’t lock private content.', 'wconvert-pro')}</li>
    </ul>
  </div>;
}
