import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { readSiteAllowance, type SiteAllowance } from '../../optins/api';
import { allowanceSummary } from '../../optins/allowanceSummary';
import { Button } from '../../components/ui/button';
import { messageOf } from '../../shell/loadable';

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
  return <aside className="wconvert-site-limits-note" aria-label={__('Site-wide limits', 'wconvert')}>
    <strong>{__('Site-wide limits also apply', 'wconvert')}</strong>
    {limits && <p>{allowanceSummary(limits)}</p>}
    {!limits && !error && <p role="status">{__('Checking saved site-wide limits…', 'wconvert')}</p>}
    {error && <><p role="alert">{__('Could not check the site-wide limits.', 'wconvert')} {error}</p>
      <Button size="sm" variant="outline" onClick={() => setRetry((value) => value + 1)}>{__('Retry checking limits', 'wconvert')}</Button></>}
    <p>{__('An Optin cannot override these limits.', 'wconvert')} <a href="#optins">{__('Manage them on the Optins page', 'wconvert')}</a></p>
  </aside>;
}
