import { useCallback, useEffect, useRef, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import { ArrowUpRight, Bell, BookOpen, CircleCheck, CircleHelp, ExternalLink, LifeBuoy, Rocket, Search, Sparkles } from 'lucide-react';
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Button } from '../components/ui/button';
import { readDestinations } from '../destinations/api';
import { issueCount } from '../destinations/issueCount';
import { campaignName, listOptins, type OptinSummary } from '../optins/api';
import { StatusBadge } from '../optins/StatusBadge';
import { editorHref, sendingIssuesHref, settingsHref } from '../nav';
import { tierName, tierProductName } from '../goals/availability';
import { formatCount } from '../lib/format';
import { TryAgain } from './Region';
import { RowsSkeleton } from './RowsSkeleton';
import { messageOf } from './loadable';
import { adminSettings } from '../settings';
import { PlanBadge } from './Brand';
import { DOCS_URL, GUIDES, docsUrl } from './docs';

/** Where every "Explore Pro" link on a free install goes. */
export const EXPLORE_PRO_URL = 'https://wconvert.io/pricing/';

/** WordPress's Plugins screen, where an installed but inactive Pro is activated (ADR 0147). */
export const PLUGINS_URL = 'plugins.php';

/** Which free surface a Pro link came from, as its `utm_medium` (ADR 0147). */
export type ProMedium = 'header' | 'settings-list' | 'rule-menu' | 'flow-map' | 'destinations' | 'campaign-menu';

/**
 * A Pro link, tagged with where it was. Fixed values only: never the site, the
 * version, the user or a count — nothing about this install leaves (G7).
 */
export function proUrl(medium: ProMedium): string {
  return `${EXPLORE_PRO_URL}?utm_source=wconvert-free&utm_medium=${medium}&utm_campaign=explore-pro`;
}

/**
 * Where a customer who already paid downloads the paid plugin. A plain link
 * with no remote call: a free install learns nothing about whether its owner
 * bought anything, and asks nobody.
 */
export const PORTAL_DOWNLOADS_URL = 'https://my.wconvert.io/account/downloads';

/**
 * **Help's destinations, in one place** (ADR 0097, amended by ADR 0144): the
 * header's popover, the footer and the Help page all read this table, so one
 * place is never three addresses. `changes` is the plugin's wordpress.org
 * changelog until wconvert.io has one.
 */
export const HELP_URLS = {
  start: docsUrl(GUIDES.firstCampaign),
  guides: DOCS_URL,
  support: 'https://wconvert.io/support/',
  changes: 'https://wordpress.org/plugins/wconvert/#developers',
} as const;

/** The Help page's hash on the one WConvert screen (`help/page.ts`). */
export const HELP_PAGE_ID = 'help';

export function HeaderTools({ currentPage }: { currentPage?: string } = {}) {
  const tier = adminSettings()?.installedTier ?? 'free';
  const proInactive = adminSettings()?.proInstalledInactive === true;
  const [notices, setNotices] = useState<{ campaigns: OptinSummary[]; sending: number; formsPaused: boolean; protectionChecked: boolean } | null>(
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
        protectionChecked: protection !== null,
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
      {tier === 'free' && proInactive && (
        // Pro is on disk and not running: what to do is on Plugins, not on the sales page (ADR 0147).
        <a className="wconvert-explore-pro" href={PLUGINS_URL}>
          {sprintf(/* translators: %s: the product, e.g. “WConvert Pro”. */ __('%s is installed. Activate it', 'wconvert'), tierProductName('pro'))}
        </a>
      )}
      {tier === 'free' && !proInactive && (
        <a
          className="wconvert-explore-pro"
          href={proUrl('header')}
          target="_blank"
          rel="noreferrer"
        >
          {sprintf(/* translators: %s: the paid tier's name, e.g. “Pro”. */ __('Explore %s', 'wconvert'), tierName('pro'))}
        </a>
      )}
      {tier === 'free' && !proInactive && (
        <span className="wconvert-already-bought">
          {__('Already bought?', 'wconvert')}{' '}
          <a href={PORTAL_DOWNLOADS_URL} target="_blank" rel="noreferrer">
            {__('Download it', 'wconvert')}<span aria-hidden="true"> ↗</span>
            <span className="sr-only">{__('(opens in a new tab)', 'wconvert')}</span>
          </a>
        </span>
      )}
      {/* The plan badge's phone copy: the navigation row hides its own below 600px. */}
      <span className="wconvert-plan-mobile"><PlanBadge tier={tier} currentPage={currentPage} /></span>
      <Popover>
        <PopoverTrigger asChild>
          {/* On the Help page the ? reads as "you are here", as the plan badge does on its page (ADR 0143). */}
          <Button variant="ghost" size="icon-sm" aria-label={__('Help', 'wconvert')} aria-current={currentPage === HELP_PAGE_ID ? 'page' : undefined}>
            <CircleHelp aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="wconvert-header-popover">
          <HelpLinks currentPage={currentPage} />
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
                ? sprintf(/* translators: %d: how many issues the notifications list holds. */ _n('Notifications, %d issue', 'Notifications, %d issues', count, 'wconvert'), count)
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
              <p>{sprintf(/* translators: %s: the reason loading failed, as the server gave it. */ __('Notifications couldn’t load: %s', 'wconvert'), error)}</p>
              <TryAgain onClick={() => void load()} busy={loading} />
            </div>
          )}
          {loading && !notices && !error ? <RowsSkeleton rows={2} /> : (
            notices && (
              <>
                {count === 0 && (
                  <p className="wconvert-notification__clear">
                    <CircleCheck aria-hidden="true" />
                    {/* Only claim everything when everything was read. */}
                    {notices.protectionChecked ? __('Everything is running. Checked just now.', 'wconvert') : __('No campaign or sending issues.', 'wconvert')}
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
                        /* translators: %d: how many destinations have a known sending issue. */
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
 * **One Help**, opened from the header's ? and from the footer (ADR 0131),
 * and the Help page it leads to (ADR 0144): the same name and the same links
 * in all three, so none reads as a second, different kind of help. On the
 * Help page itself the link to it is left out.
 */
export function HelpLinks({ currentPage }: { currentPage?: string } = {}) {
  const version = adminSettings()?.version;
  const out = (href: string, Icon: typeof Rocket, label: string) => (
    <a href={href} target="_blank" rel="noreferrer">
      <Icon aria-hidden="true" />{label}
      <ArrowUpRight aria-hidden="true" className="wconvert-help-links__out" />
      <span className="sr-only">{__('(opens in a new tab)', 'wconvert')}</span>
    </a>
  );
  return <>
    <h2>{__('Help', 'wconvert')}</h2>
    {/* The Help page's own search, one Enter away: it opens wconvert.io's docs in a new tab (ADR 0144). */}
    <form className="wconvert-help-links__search" role="search" action={HELP_URLS.guides} method="get" target="_blank" rel="noreferrer">
      <Search aria-hidden="true" />
      <input name="q" type="search" autoComplete="off" placeholder={__('Search the guides', 'wconvert')}
        aria-label={__('Search the guides on wconvert.io', 'wconvert')} />
    </form>
    {out(HELP_URLS.start, Rocket, __('Getting started', 'wconvert'))}
    {out(HELP_URLS.guides, BookOpen, __('Guides', 'wconvert'))}
    {out(HELP_URLS.support, LifeBuoy, __('Contact support', 'wconvert'))}
    {out(HELP_URLS.changes, Sparkles, version
      ? sprintf(/* translators: %s: the plugin's version, e.g. 1.0.0. */ __('What’s new in %s', 'wconvert'), version)
      : __('What’s new', 'wconvert'))}
    <div className="wconvert-help-links__foot">
      {currentPage !== HELP_PAGE_ID && (
        <PopoverClose asChild>
          <Button asChild variant="outline" size="sm"><a className="wconvert-help-links__open" href={`#${HELP_PAGE_ID}`}>{__('Open the Help page', 'wconvert')}</a></Button>
        </PopoverClose>
      )}
      <a className="wconvert-help-links__site" href="https://wconvert.io/" target="_blank" rel="noreferrer">
        {__('WConvert website', 'wconvert')} <ExternalLink aria-hidden="true" />
      </a>
    </div>
  </>;
}

