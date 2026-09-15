import { useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { Bell, CircleHelp, ExternalLink, UserRound } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Button } from '../components/ui/button';
import { readDestinations } from '../destinations/api';
import { issueCount } from '../destinations/issueCount';
import { listOptins, type OptinSummary } from '../optins/api';
import { editorHref, sendingIssuesHref, settingsHref } from '../nav';
import { adminSettings } from '../settings';

export function HeaderTools() {
  const tier = adminSettings()?.installedTier ?? 'free';
  const [notices, setNotices] = useState<{ campaigns: OptinSummary[]; sending: number } | null>(
    null,
  );
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const [campaigns, destinations] = await Promise.all([listOptins(), readDestinations()]);
      setNotices({
        campaigns: campaigns
          .flatMap((c) => [c, ...c.arms])
          .filter((c) => c.published_at !== null && c.deleted_at === null && c.suspended !== null),
        sending: issueCount(destinations),
      });
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };
  const count = notices ? notices.campaigns.length + notices.sending : 0;
  return (
    <div className="wc-header-tools">
      {tier === 'free' && (
        <a
          className="wc-explore-pro"
          href="https://wconvert.io/pro/"
          target="_blank"
          rel="noreferrer"
        >
          {__('Explore Pro', 'wconvert')}
        </a>
      )}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={__('Help and support', 'wconvert')}>
            <CircleHelp aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="wc-header-popover">
          <h2>{__('Help and support', 'wconvert')}</h2>
          <a href={settingsHref('experience')}>{__('Visitor experience settings', 'wconvert')}</a>
          <a href={settingsHref('connections')}>{__('Connections & destinations', 'wconvert')}</a>
          <a href="https://wconvert.io/" target="_blank" rel="noreferrer">
            {__('WConvert website', 'wconvert')} <ExternalLink aria-hidden="true" />
          </a>
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
            className="wc-notifications-trigger"
            aria-label={__('Notifications', 'wconvert')}
          >
            <Bell aria-hidden="true" />
            {count > 0 && <span className="wc-notification-dot" />}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="wc-header-popover wc-notifications">
          <h2>{__('Notifications', 'wconvert')}</h2>
          {loading ? (
            <p role="status">{__('Checking campaign and sending issues…', 'wconvert')}</p>
          ) : failed ? (
            <>
              <p role="alert">{__('Notifications couldn’t load.', 'wconvert')}</p>
              <Button variant="outline" size="sm" onClick={() => void load()}>
                {__('Try again', 'wconvert')}
              </Button>
            </>
          ) : (
            notices && (
              <>
                {count === 0 && <p>{__('No known campaign or sending issues.', 'wconvert')}</p>}
                {notices.campaigns.map((c) => (
                  <div className="wc-notification" key={c.id}>
                    <strong>{c.name}</strong>
                    <p>{c.suspended}</p>
                    <a href={editorHref(c.id)}>{__('Review campaign', 'wconvert')}</a>
                  </div>
                ))}
                {notices.sending > 0 && (
                  <div className="wc-notification">
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
      {/* Account destination is intentionally a # placeholder until login is integrated. */}
      {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
      <a
        className="wc-account-link"
        href="#"
        onClick={(event) => event.preventDefault()}
        aria-label={__('Sign in to WConvert', 'wconvert')}
      >
        <UserRound aria-hidden="true" />
      </a>
    </div>
  );
}
