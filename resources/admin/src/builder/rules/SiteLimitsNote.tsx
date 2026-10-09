import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { TryAgain } from '../../shell/Region';
import { readSiteAllowance, type SiteAllowance } from '../../optins/api';
import { allowanceSummary, hasSiteLimits } from '../../optins/allowanceSummary';
import { messageOf } from '../../shell/loadable';
import { settingsHref } from '../../nav';

/** Read the saved site veto beside the draft's per-Optin allowance. */
export function SiteLimitsNote() {
  const [limits, setLimits] = useState<SiteAllowance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError(null);
    void readSiteAllowance().then((next) => { if (active) setLimits(next); })
      .catch((cause: unknown) => { if (active) setError(messageOf(cause)); });
    return () => { active = false; };
  }, [retry]);
  // Nothing to say while it loads, or when the site sets no limit: the note
  // exists only for the day a site-wide cap is why a Campaign stayed quiet.
  if (error === null && (limits === null || !hasSiteLimits(limits))) return null;
  return <aside className="wconvert-site-limits-note" aria-label={__('Site-wide limits', 'wconvert')}>
    {limits && <><strong>{__('Site-wide limits also apply', 'wconvert')}</strong><p>{allowanceSummary(limits)}</p></>}
    {error && <><p role="alert">{__('Could not check the site-wide limits.', 'wconvert')} {error}</p>
      <TryAgain onClick={() => setRetry((value) => value + 1)} /></>}
    <p>{__('A campaign cannot override these limits.', 'wconvert')} <a href={settingsHref('experience')}>{__('Manage them in Settings', 'wconvert')}</a></p>
  </aside>;
}
