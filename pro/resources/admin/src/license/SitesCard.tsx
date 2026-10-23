import { useState, type ReactNode, type RefObject } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { KeyRound, Search, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable, DataTableBody, DataTableCell, DataTableColumn, DataTableHead, DataTableRow } from '@/shell/DataTable';
import { Disclosure } from '@/shell/Disclosure';
import { FactList } from '@/shell/FactList';
import { Region, RegionBody, RegionFooter, RegionHeader } from '@/shell/Region';
import { formatShortDay } from '@/lib/format';
import { type LicensePayload, type LicenseSite } from './describeLicense';
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
  headingRef: RefObject<HTMLDivElement | null>;
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
    <Region label={__('Sites', 'wconvert-pro')}>
      {/* The status card's "Manage sites" scrolls here and moves focus to the heading. */}
      <div ref={headingRef} tabIndex={-1} className="wconvert-license-anchor">
        <RegionHeader title={__('Sites', 'wconvert-pro')} trailing={
          <span className="wconvert-license-muted" data-over={over ? '' : undefined}>
            {max === null
              ? sprintf(/* translators: %d: how many sites this license is active on. */ _n('%d site · Unlimited', '%d sites · Unlimited', used, 'wconvert-pro'), used)
              : sprintf(/* translators: 1: how many sites this license is active on, 2: how many sites the license allows. */ __('%1$d of %2$d used', 'wconvert-pro'), used, max)}
          </span>
        } />
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
      <DataTable className="wconvert-license-sites" label={__('Sites on this license', 'wconvert-pro')}>
        <DataTableHead>
          <DataTableColumn>{__('Site', 'wconvert-pro')}</DataTableColumn>
          <DataTableColumn>{__('Added', 'wconvert-pro')}</DataTableColumn>
          <DataTableColumn><span className="sr-only">{__('Actions', 'wconvert-pro')}</span></DataTableColumn>
        </DataTableHead>
        <DataTableBody>
          {shown.map((site) => {
            const stale = site.last_seen !== null && now - Date.parse(site.last_seen) > STALE_DAYS * 86_400_000;
            return (
              <DataTableRow key={site.domain}>
                <DataTableCell label={__('Site', 'wconvert-pro')}>
                  <span className="wconvert-license-site">
                    <span className="wconvert-license-domain">{site.domain}</span>
                    {site.here && <Badge variant="secondary">{__('This site', 'wconvert-pro')}</Badge>}
                    {site.dev && <Badge variant="outline">{__('Dev', 'wconvert-pro')}</Badge>}
                    {stale && site.last_seen && <small className="wconvert-license-warn-text">{sprintf(/* translators: %s: the date a site last checked in, e.g. “Nov 27, 2026”. */ __('Not seen since %s', 'wconvert-pro'), formatShortDay(site.last_seen))}</small>}
                  </span>
                </DataTableCell>
                <DataTableCell label={__('Added', 'wconvert-pro')} className="wconvert-license-num">{site.added ? formatShortDay(site.added) : '—'}</DataTableCell>
                <DataTableCell label={__('Actions', 'wconvert-pro')} className="wconvert-license-act-cell">
                  {!site.here && (
                    <Button variant="ghost" size="sm" aria-disabled={busy !== null || undefined}
                      aria-label={sprintf(/* translators: %s: a site's domain, e.g. “example.com”. */ __('Remove %s', 'wconvert-pro'), site.domain)}
                      onClick={() => busy === null && onRemove(site)}>
                      {busy === `site:${site.domain}` ? __('Removing…', 'wconvert-pro') : __('Remove', 'wconvert-pro')}
                    </Button>
                  )}
                </DataTableCell>
              </DataTableRow>
            );
          })}
          {shown.length === 0 && (
            <DataTableRow><DataTableCell label={__('Site', 'wconvert-pro')} className="wconvert-license-muted">{sprintf(/* translators: %s: the text typed into the site search. */ __('No site matches “%s”.', 'wconvert-pro'), query)}</DataTableCell></DataTableRow>
          )}
        </DataTableBody>
      </DataTable>
      {max !== null && (
        <RegionFooter>{__('Need more sites?', 'wconvert-pro')} <Ext href={license.urls.upgrade ?? '#'}>{__('Upgrade', 'wconvert-pro')}</Ext></RegionFooter>
      )}
    </Region>
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
    <Region label={__('License key', 'wconvert-pro')}>
      <RegionHeader title={__('License key', 'wconvert-pro')} />
      <RegionBody className="wconvert-license-card__body">
        <FactList facts={[
          { icon: KeyRound, label: __('Key', 'wconvert-pro'), text: masked ? <span className="wconvert-license-mono">{masked}</span> : __('Can’t be read', 'wconvert-pro'), tone: masked ? undefined : 'warning' },
          ...(license.buyer?.name ? [{ icon: User, label: __('Licensed to', 'wconvert-pro'), text: license.buyer.name }] : []),
        ]} />
        <Disclosure variant="inline" title={__('Use a different key', 'wconvert-pro')}>
          <KeyField id="wconvert-license-swap" label={__('New license key', 'wconvert-pro')} value={key} onChange={setKey}
            onSubmit={() => onReplace(key)} busy={busy === 'replace'} error={replaceError}
            hint={masked
              ? sprintf(/* translators: %s: the current license key with all but its last four characters hidden, e.g. “••••7F3A”. */ __('Activates the new key first, then releases %s. Updates don’t pause.', 'wconvert-pro'), masked)
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
      </RegionBody>
    </Region>
  );
}
