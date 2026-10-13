import { __, sprintf } from '@wordpress/i18n';
import { ExternalLink } from 'lucide-react';
import { tierName, tierProductName } from '../goals/availability';
import { adminSettings } from '../settings';
import { PORTAL_DOWNLOADS_URL, proUrl } from '../shell/HeaderTools';

/**
 * Free's one list of what Pro adds — static, bundled copy with no remote
 * fetch, and the only upsell beside the header's "Explore Pro" link
 * (ADR 0116). Every locked member is hidden wherever it would otherwise
 * appear, so this is where a free merchant learns the rest exists.
 */
export function MoreWithPro() {
  return (
    <aside className="mt-5 border-t border-border px-3 pt-4 text-note text-muted-foreground" aria-labelledby="wconvert-more-with-pro">
      <h2 id="wconvert-more-with-pro" className="m-0 mb-2 text-note font-medium text-foreground">
        {sprintf(/* translators: %s: the paid edition's name, e.g. “Pro”. */ __('More with %s', 'wconvert'), tierName('pro'))}
      </h2>
      <ul className="m-0 grid list-disc gap-1 ps-4">
        <li>{__('Floating bars, slide-ins and fullscreen formats', 'wconvert')}</li>
        <li>{__('Question journeys with personalized results', 'wconvert')}</li>
        <li>{__('Exit intent and advanced targeting', 'wconvert')}</li>
        <li>{__('A/B testing', 'wconvert')}</li>
        <li>{__('Email marketing and analytics integrations', 'wconvert')}</li>
      </ul>
      {adminSettings()?.proInstalledInactive ? <p className="m-0 mt-2">
        {/* Installed, not running: the way on is Plugins (ADR 0147). */}
        {sprintf(/* translators: %s: the product, e.g. “WConvert Pro”. */ __('%s is installed.', 'wconvert'), tierProductName('pro'))}{' '}
        <a className="underline" href="plugins.php">{__('Activate it', 'wconvert')}</a>
      </p> : <>
      <a className="mt-2 inline-flex items-center gap-1 underline" href={proUrl('settings-list')} target="_blank" rel="noreferrer">
        {sprintf(/* translators: %s: the paid edition's name, e.g. “Pro”. */ __('Explore %s', 'wconvert'), tierName('pro'))}<ExternalLink aria-hidden="true" className="size-3 rtl:-scale-x-100" />
        <span className="sr-only">{__('(opens in a new tab)', 'wconvert')}</span>
      </a>
      <p className="m-0 mt-2">
        {sprintf(/* translators: %s: the paid edition's name, e.g. “Pro”. */ __('Already bought %s?', 'wconvert'), tierName('pro'))}{' '}
        <a className="inline-flex items-center gap-1 underline" href={PORTAL_DOWNLOADS_URL} target="_blank" rel="noreferrer">
          {__('Download it from your account', 'wconvert')}<ExternalLink aria-hidden="true" className="size-3 rtl:-scale-x-100" />
          <span className="sr-only">{__('(opens in a new tab)', 'wconvert')}</span>
        </a>
      </p>
      </>}
    </aside>
  );
}
