import { useCallback, useEffect, useRef, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import { Bell, BookOpen, CircleCheck, CircleHelp, ExternalLink, LifeBuoy, Rocket, Sparkles } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Button } from '../components/ui/button';
import { readDestinations } from '../destinations/api';
import { issueCount } from '../destinations/issueCount';
import { campaignName, listOptins, type OptinSummary } from '../optins/api';
import { StatusBadge } from '../optins/StatusBadge';
import { editorHref, sendingIssuesHref, settingsHref } from '../nav';
import { tierName } from '../goals/availability';
import { formatCount } from '../lib/format';
import { TryAgain } from './Region';
import { RowsSkeleton } from './RowsSkeleton';
import { messageOf } from './loadable';
import { adminSettings } from '../settings';

/** Where every "Explore Pro" link on a free install goes. */
export const EXPLORE_PRO_URL = 'https://wconvert.io/pro/';

/**
 * **Help's destinations, in one place.** The owner supplies the real addresses
 * (ADR 0097: guides and support need real destinations); until then each is
 * `#`, so the shape ships and only this table changes.
 */
export const HELP_URLS = {
  start: '#',
  guides: '#',
  support: '#',
  changes: '#',
} as const;

export function HeaderTools() {
  const tier = adminSettings()?.installedTier ?? 'free';
  const [notices, setNotices] = useState<{ campaigns: OptinSummary[]; sending: number; formsPaused: boolean } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const request = useRef(0);
  const load = useCallback(async () => {
    const current = ++request.current;
    setLoading(true);
    setError(null);
    try {
      // Spam protection can pause every form; it is broken in a way the merchant can't see from a campaign.
      const [campaigns, destinations, protection] = await Promise.all([
        listOptins(),
        readDestinations(),
        apiFetch<{ rules_configured?: boolean; rules_available?: boolean }>({ path: '/wconvert/v1/protection' }).catch(() => null),
      ]);
      if (current !== request.current) return;
      setNotices({
        campaigns: campaigns
          .flatMap((c) => [c, ...c.arms])
          .filter((c) => c.published_at !== null && c.deleted_at === null && c.suspended !== null),
        sending: issueCount(destinations),
        formsPaused: protection?.rules_configured === true && protection.rules_available === false,
      });
    } catch (cause) {
      // A failed refresh keeps what the bell already knew (GUIDELINES §13).
      if (current === request.current) setError(messageOf(cause));
    } finally {
      if (current === request.current) setLoading(false);
    }
  }, []);
  // Read on load, not on open: the unread dot is the whole point of the bell,
  // and a dot that only appears once the merchant has already looked says
  // nothing at all.
  useEffect(() => {
    void load();
    return () => {
      request.current += 1;
    };
  }, [load]);
  const count = notices ? notices.campaigns.length + notices.sending + Number(notices.formsPaused) : 0;
  return (
    <div className="wconvert-header-tools">
      {tier === 'free' && (
        <a
          className="wconvert-explore-pro"
          href={EXPLORE_PRO_URL}
          target="_blank"
          rel="noreferrer"
        >
          {sprintf(__('Explore %s', 'wconvert'), tierName('pro'))}
        </a>
      )}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={__('Help', 'wconvert')}>
            <CircleHelp aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="wconvert-header-popover">
          <HelpLinks />
        </PopoverContent>
      </Popover>
      <Popover
        onOpenChange={(open) => {
          if (open) void load();
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="wconvert-notifications-trigger"
            aria-label={
              count > 0
                ? sprintf(_n('Notifications, %d issue', 'Notifications, %d issues', count, 'wconvert'), count)
                : __('Notifications', 'wconvert')
            }
          >
            <Bell aria-hidden="true" />
            {/* A number, not a 5px dot: "is anything broken" is read from the header without opening it. */}
            {count > 0 && <span className="wconvert-notification-count" aria-hidden="true">{formatCount(count)}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="wconvert-header-popover wconvert-notifications">
          <h2>{__('Notifications', 'wconvert')}</h2>
          {error && (
            <div role="alert" className="wconvert-notification">
              <p>{sprintf(__('Notifications couldn’t load: %s', 'wconvert'), error)}</p>
              <TryAgain onClick={() => void load()} busy={loading} />
            </div>
          )}
          {loading && !notices && !error ? <RowsSkeleton rows={2} /> : (
            notices && (
              <>
                {count === 0 && (
                  <p className="wconvert-notification__clear">
                    <CircleCheck aria-hidden="true" />
                    {__('Everything is running. Checked just now.', 'wconvert')}
                  </p>
                )}
                {notices.formsPaused && (
                  <div className="wconvert-notification">
                    <strong>{__('Forms are paused', 'wconvert')}</strong>
                    <p>{__('Saved email filters aren’t available on this site, so no form accepts submissions.', 'wconvert')}</p>
                    <a href={settingsHref('protection')}>{__('Review spam protection', 'wconvert')}</a>
                  </div>
                )}
                {notices.campaigns.map((c) => (
                  <div className="wconvert-notification" key={c.id}>
                    <div className="wconvert-notification__title">
                      <strong>{campaignName(c)}</strong>
                      <StatusBadge status="suspended" />
                    </div>
                    <p>{c.suspended}</p>
                    <a href={editorHref(c.id)}>{__('Review campaign', 'wconvert')}</a>
                  </div>
                ))}
                {notices.sending > 0 && (
                  <div className="wconvert-notification">
                    <strong>{__('Sending needs attention', 'wconvert')}</strong>
                    <p>
                      {sprintf(
                        _n(
                          '%d destination has a known issue.',
                          '%d destinations have known issues.',
                          notices.sending,
                          'wconvert',
                        ),
                        notices.sending,
                      )}
                    </p>
                    <a href={sendingIssuesHref()}>{__('Review sending issues', 'wconvert')}</a>
                  </div>
                )}
              </>
            )
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

/**
 * **One Help**, opened from the header's ? and from the footer (ADR 0131):
 * the same name and the same links in both, so neither reads as a second,
 * different kind of help.
 */
export function HelpLinks() {
  const version = adminSettings()?.version;
  return <>
    <h2>{__('Help', 'wconvert')}</h2>
    <a href={HELP_URLS.start} target="_blank" rel="noreferrer"><Rocket aria-hidden="true" />{__('Getting started', 'wconvert')}</a>
    <a href={HELP_URLS.guides} target="_blank" rel="noreferrer"><BookOpen aria-hidden="true" />{__('Guides', 'wconvert')}</a>
    <a href={HELP_URLS.support} target="_blank" rel="noreferrer"><LifeBuoy aria-hidden="true" />{__('Contact support', 'wconvert')}</a>
    <a href={HELP_URLS.changes} target="_blank" rel="noreferrer"><Sparkles aria-hidden="true" />
      {version ? sprintf(/* translators: %s: the plugin's version, e.g. 1.0.0. */ __('What’s new in %s', 'wconvert'), version) : __('What’s new', 'wconvert')}
    </a>
    <a className="wconvert-help-site" href="https://wconvert.io/" target="_blank" rel="noreferrer">
      {__('WConvert website', 'wconvert')} <ExternalLink aria-hidden="true" />
    </a>
  </>;
}
