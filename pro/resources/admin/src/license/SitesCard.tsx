import { useState, type ReactNode, type RefObject } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { KeyRound, Search, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Disclosure } from '@/shell/Disclosure';
import { FactList } from '@/shell/FactList';
import { short, type LicensePayload, type LicenseSite } from './describeLicense';
import { Ext, KeyField } from './parts';

/** Search appears once a list is long enough to need it. */
const SEARCH_FROM = 10;

/** A site the store has not heard from in this long reads as gone. */
const STALE_DAYS = 30;

/**
 * The sites this licence is on: how many of the plan are used, each site, and
 * Remove for the ones that are not this one (this one is removed from the
 * License key card). Staging and local copies are listed and use no site.
 */
export function SitesCard({ license, onRemove, busy, result, headingRef, now = Date.now() }: {
  license: LicensePayload;
  onRemove: (site: LicenseSite) => void;
  busy: string | null;
  result?: ReactNode;
  headingRef: RefObject<HTMLHeadingElement | null>;
  now?: number;
}) {
  const [query, setQuery] = useState('');
  const max = license.plan?.max ?? null;
  const used = license.plan?.used ?? license.sites.filter((site) => !site.dev).length;
  const over = license.state === 'over_limit';
  const order = (site: LicenseSite) => (site.here ? 0 : site.dev ? 2 : 1);
  const shown = license.sites
    .filter((site) => site.domain.includes(query.trim().toLowerCase()))
    .slice()
    .sort((a, b) => order(a) - order(b));

  return (
    <section className="wconvert-license-card" aria-labelledby="wconvert-license-sites">
      <div className="wconvert-license-card__head">
        <h2 id="wconvert-license-sites" ref={headingRef} tabIndex={-1}>{__('Sites', 'wconvert-pro')}</h2>
        <span className="wconvert-license-muted" data-over={over ? '' : undefined}>
          {max === null
            ? sprintf(_n('%d site · Unlimited', '%d sites · Unlimited', used, 'wconvert-pro'), used)
            : sprintf(__('%1$d of %2$d used', 'wconvert-pro'), used, max)}
        </span>
      </div>
      {max !== null && max > 1 && (
        <div className="wconvert-license-meter-wrap">
          <span className="wconvert-license-meter" aria-hidden="true">
            {Array.from({ length: Math.max(max, used) }).map((_, i) => <i key={i} data-on={i < used && i < max ? '' : undefined} data-over={i >= max ? '' : undefined} />)}
          </span>
          {license.sites.some((site) => site.dev) && <span className="wconvert-license-hint">{__('Dev sites, like staging and local copies, are free.', 'wconvert-pro')}</span>}
        </div>
      )}
      {license.sites.length > SEARCH_FROM && (
        <div className="wconvert-license-search">
          <Search aria-hidden="true" />
          <Input type="search" aria-label={__('Search sites', 'wconvert-pro')} placeholder={__('Search sites', 'wconvert-pro')} value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
      )}
      {result && <div className="wconvert-license-card__result">{result}</div>}
      <table className="wconvert-license-sites">
        <thead><tr>
          <th scope="col">{__('Site', 'wconvert-pro')}</th>
          <th scope="col">{__('Added', 'wconvert-pro')}</th>
          <th scope="col"><span className="sr-only">{__('Actions', 'wconvert-pro')}</span></th>
        </tr></thead>
        <tbody>
          {shown.map((site) => {
            const stale = site.last_seen !== null && now - Date.parse(site.last_seen) > STALE_DAYS * 86_400_000;
            return (
              <tr key={site.domain}>
                <td>
                  <span className="wconvert-license-site">
                    <span className="wconvert-license-domain">{site.domain}</span>
                    {site.here && <Badge variant="secondary">{__('This site', 'wconvert-pro')}</Badge>}
                    {site.dev && <Badge variant="outline">{__('Dev', 'wconvert-pro')}</Badge>}
                    {stale && <small className="wconvert-license-warn-text">{sprintf(__('Not seen since %s', 'wconvert-pro'), short(site.last_seen, now))}</small>}
                  </span>
                </td>
                <td className="wconvert-license-num" data-label={__('Added', 'wconvert-pro')}>{short(site.added, now)}</td>
                <td className="wconvert-license-act-cell">
                  {!site.here && (
                    <Button variant="ghost" size="sm" aria-disabled={busy !== null || undefined}
                      aria-label={sprintf(__('Remove %s', 'wconvert-pro'), site.domain)}
                      onClick={() => busy === null && onRemove(site)}>
                      {busy === `site:${site.domain}` ? __('Removing…', 'wconvert-pro') : __('Remove', 'wconvert-pro')}
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
          {shown.length === 0 && <tr><td colSpan={3} className="wconvert-license-muted">{sprintf(__('No site matches “%s”.', 'wconvert-pro'), query)}</td></tr>}
        </tbody>
      </table>
      {max !== null && (
        <div className="wconvert-license-card__foot">{__('Need more sites?', 'wconvert-pro')} <Ext href={license.urls.upgrade ?? '#'}>{__('Upgrade', 'wconvert-pro')}</Ext></div>
      )}
    </section>
  );
}

/**
 * The key: masked, who it is licensed to, swapping it for another without a
 * gap in updates, and removing it from this site.
 */
export function KeyCard({ license, busy, onReplace, replaceError, onRemove }: {
  license: LicensePayload;
  busy: string | null;
  onReplace: (key: string) => void;
  replaceError?: ReactNode;
  onRemove: () => void;
}) {
  const [key, setKey] = useState('');
  const masked = license.key.masked;

  return (
    <section className="wconvert-license-card" aria-labelledby="wconvert-license-key">
      <div className="wconvert-license-card__head"><h2 id="wconvert-license-key">{__('License key', 'wconvert-pro')}</h2></div>
      <div className="wconvert-license-card__body">
        <FactList facts={[
          { icon: KeyRound, label: __('Key', 'wconvert-pro'), text: masked ? <span className="wconvert-license-mono">{masked}</span> : __('Can’t be read', 'wconvert-pro'), tone: masked ? undefined : 'warning' },
          ...(license.buyer?.name ? [{ icon: User, label: __('Licensed to', 'wconvert-pro'), text: license.buyer.name }] : []),
        ]} />
        <Disclosure variant="inline" title={__('Use a different key', 'wconvert-pro')}>
          <KeyField id="wconvert-license-swap" label={__('New license key', 'wconvert-pro')} value={key} onChange={setKey}
            onSubmit={() => onReplace(key)} busy={busy === 'replace'} error={replaceError}
            hint={masked
              ? sprintf(__('Activates the new key first, then releases %s. Updates don’t pause.', 'wconvert-pro'), masked)
              : __('Activates the new key on this site.', 'wconvert-pro')} />
        </Disclosure>
        <div className="wconvert-license-danger">
          <div>
            <b>{__('Remove from this site', 'wconvert-pro')}</b>
            <p className="wconvert-license-hint">{__('Frees a site on your license.', 'wconvert-pro')}</p>
          </div>
          <Button variant="outline" size="sm" aria-disabled={busy !== null || undefined} onClick={() => busy === null && onRemove()}>
            {busy === 'remove' ? __('Removing…', 'wconvert-pro') : __('Remove', 'wconvert-pro')}
          </Button>
        </div>
      </div>
    </section>
  );
}
