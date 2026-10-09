import { useEffect, useState, type ReactNode } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { settingsHref } from '../nav';
import { formatCount, labelOf } from '../lib/format';
import { DataTable, DataTableBody, DataTableCell, DataTableColumn, DataTableHead, DataTableRow } from '../shell/DataTable';
import { Description } from '../shell/Description';
import { Disclosure } from '../shell/Disclosure';
import { Region, RegionBody, RegionErrorState, RegionHeader } from '../shell/Region';
import { RegionSkeleton } from '../shell/RegionSkeleton';
import { failed, LOADING, ready, type Loadable } from '../shell/loadable';
import { readDataMap, type PrivacyDataMap as DataMap } from './api';

/**
 * Read at render, not at import: a module-scope `__()` runs before the
 * translations are loaded and freezes every label in English.
 */
const fieldNames = (): Readonly<Record<string, string>> => ({
  email: __('Email address', 'wconvert'),
  phone: __('Phone number', 'wconvert'),
  name: __('Name', 'wconvert'),
  interest: __('Interest answer', 'wconvert'),
  consent: __('Consent', 'wconvert'),
  'mapped form/quiz answers': __('Mapped form and quiz answers', 'wconvert'),
});

const providerNames = (): Readonly<Record<string, string>> => ({
  turnstile: 'Cloudflare Turnstile',
  recaptcha: 'Google reCAPTCHA',
  hcaptcha: 'hCaptcha',
});

const days = (count: number) => sprintf(
  /* translators: %s: number of days. */
  _n('%s day', '%s days', count, 'wconvert'),
  formatCount(count),
);

const duration = (seconds: number) => seconds === 60
  ? __('One minute', 'wconvert')
  : seconds % 3600 === 0
    ? sprintf(
      /* translators: %s: number of hours. */
      _n('%s hour', '%s hours', seconds / 3600, 'wconvert'),
      formatCount(seconds / 3600),
    )
    : seconds % 60 === 0
      ? sprintf(
        /* translators: %s: number of minutes. */
        _n('%s minute', '%s minutes', seconds / 60, 'wconvert'),
        formatCount(seconds / 60),
      )
      : sprintf(
        /* translators: %s: number of seconds. */
        _n('%s second', '%s seconds', seconds, 'wconvert'),
        formatCount(seconds),
      );

interface Stored { key: string; what: string; where: string; why: string; kept: string }

/**
 * What this install stores, from the facts `DataMap.php` can prove: one row
 * per record, saying what it is, why it exists and how long it lasts. Rows for
 * modules this site does not run are absent, not "n/a".
 */
function storedRows(data: DataMap): Stored[] {
  const here = __('In WConvert', 'wconvert');
  const browser = __('In the visitor’s browser', 'wconvert');
  const tab = __('In the visitor’s browser tab', 'wconvert');
  const rows: (Stored | null)[] = [
    {
      key: 'submissions',
      what: __('Form submissions: answers, consent text, the campaign, the time, and any name, email or phone entered', 'wconvert'),
      where: here,
      why: __('So you can see, export and send your leads', 'wconvert'),
      kept: data.retention_days === null
        ? __('Until you delete them', 'wconvert')
        : sprintf(
          /* translators: %s: a number of days, e.g. “90 days”. */
          __('%s after submission', 'wconvert'),
          days(data.retention_days),
        ),
    },
    {
      key: 'totals',
      what: __('Daily totals per campaign: shown, closed and completed. Not individual visitors', 'wconvert'),
      where: here,
      why: __('For your campaign reports', 'wconvert'),
      kept: __('No limit. They hold no personal data', 'wconvert'),
    },
    data.product_activity_retention_days ? {
      key: 'products',
      what: __('Daily counts per product and campaign, without visitor IDs', 'wconvert'),
      where: here,
      why: __('For product recommendation reports', 'wconvert'),
      kept: days(data.product_activity_retention_days),
    } : null,
    {
      key: 'history',
      what: data.browser.stores_ab_assignment
        ? __('Whether the visitor saw, closed or completed each campaign, and their A/B test version', 'wconvert')
        : __('Whether the visitor saw, closed or completed each campaign', 'wconvert'),
      where: browser,
      why: __('So display rules know who has seen what', 'wconvert'),
      kept: __('Until the visitor clears it', 'wconvert'),
    },
    {
      key: 'session',
      what: __('How often each campaign showed in this tab', 'wconvert'),
      where: tab,
      why: __('Only for a campaign that limits shows per session', 'wconvert'),
      kept: __('Until the tab closes', 'wconvert'),
    },
    data.browser.reopen_session != null ? {
      key: 'reopen',
      what: __('Which campaigns and reopen buttons the visitor closed', 'wconvert'),
      where: tab,
      why: __('For the reopen button', 'wconvert'),
      kept: __('Until the browser session ends', 'wconvert'),
    } : null,
    data.browser.content_unlock != null ? {
      key: 'unlock',
      what: __('Which content locks the visitor unlocked', 'wconvert'),
      where: browser,
      why: __('Keeps locked content open after signup', 'wconvert'),
      kept: days(30),
    } : null,
    data.browser.cart_recovery !== null ? {
      key: 'cart',
      what: __('The cart’s item count and total', 'wconvert'),
      where: browser,
      why: __('For cart display rules', 'wconvert'),
      kept: __('Until the WooCommerce cart session ends', 'wconvert'),
    } : null,
    {
      key: 'beacon',
      what: __('A one-way code made from the IP address, not the address itself', 'wconvert'),
      where: here,
      why: __('Stops one view being counted twice', 'wconvert'),
      kept: duration(data.beacon_rate_limit_seconds),
    },
    {
      key: 'capture',
      what: __('A one-way code made from the IP address, per campaign', 'wconvert'),
      where: here,
      why: __('Slows repeated form submissions', 'wconvert'),
      kept: duration(data.capture_rate_limit_seconds),
    },
    data.resource_send_limit_seconds ? {
      key: 'resource',
      what: __('A one-way code of the recipient and the resource', 'wconvert'),
      where: here,
      why: __('Stops the same resource email being sent repeatedly', 'wconvert'),
      kept: duration(data.resource_send_limit_seconds),
    } : null,
    {
      key: 'protection',
      what: __('Approximate counts of spam checks', 'wconvert'),
      where: here,
      why: __('For spam protection activity', 'wconvert'),
      kept: duration(86400),
    },
  ];
  return rows.filter((row): row is Stored => row !== null);
}

interface Recipient { key: string; name: ReactNode; service?: string; receives: ReactNode }

function recipientRows(data: DataMap): Recipient[] {
  const fields = fieldNames();
  const rows: Recipient[] = data.destinations.map((destination) => ({
    key: destination.id,
    name: <bdi>{destination.label || __('Unnamed', 'wconvert')}</bdi>,
    // A type this install no longer registers comes back with its stored key
    // as its label, so it is not shown.
    service: destination.fields === null ? undefined : destination.type_label,
    receives: destination.fields === null ? (
      <span className="text-warning">
        {__('Unknown: this destination’s service isn’t available on this site. Review or remove it.', 'wconvert')}
      </span>
    ) : destination.fields.map((field) => labelOf(field, fields, __('Other answers', 'wconvert'))).join(', '),
  }));
  const analytics = data.analytics_integration;
  if (analytics?.configured) {
    rows.push({
      key: 'analytics',
      name: __('Analytics', 'wconvert'),
      service: analytics.route === 'plausible' ? 'Plausible' : 'Google Analytics',
      receives: __('Campaign IDs, public labels and outcome types, under your consent setting. No form details; the existing tag may add its own identifiers.', 'wconvert'),
    });
  }
  if (data.protection_provider && data.protection_provider !== 'none') {
    rows.push({
      key: 'protection',
      name: __('Bot verification', 'wconvert'),
      service: labelOf(data.protection_provider, providerNames(), __('Verification service', 'wconvert')),
      receives: __('Browser and network information, and a verification token. No form answers.', 'wconvert'),
    });
  }
  return rows;
}

/** A read-only account of this install's actual personal-data boundaries. */
export function PrivacyDataMap() {
  const [state, setState] = useState<Loadable<DataMap>>(LOADING);
  const [retry, setRetry] = useState(0);
  const title = __('What visitor data is stored', 'wconvert');

  useEffect(() => {
    let active = true;
    setState(LOADING);
    void readDataMap()
      .then((data) => { if (active) setState(ready(data)); })
      .catch((cause) => { if (active) setState(failed(cause)); });
    return () => { active = false; };
  }, [retry]);

  if (state.status === 'loading') return <RegionSkeleton label={title} lines={5} />;

  if (state.status === 'failed') {
    return (
      <Region>
        <RegionHeader title={title} />
        <RegionErrorState message={state.message} onRetry={() => setRetry((value) => value + 1)} />
      </Region>
    );
  }

  const data = state.data;
  const stored = storedRows(data);
  const recipients = recipientRows(data);
  const what = __('What is stored', 'wconvert');
  const why = __('Why', 'wconvert');
  const kept = __('How long', 'wconvert');
  const service = __('Service', 'wconvert');
  const receives = __('Receives', 'wconvert');

  return (
    <Region>
      <RegionHeader
        title={title}
        description={__('What this site keeps, and why. Rows follow your current setup.', 'wconvert')}
      />
      <DataTable label={what}>
        <DataTableHead>
          <DataTableColumn>{what}</DataTableColumn>
          <DataTableColumn>{why}</DataTableColumn>
          <DataTableColumn>{kept}</DataTableColumn>
        </DataTableHead>
        <DataTableBody>
          {stored.map((row) => (
            <DataTableRow key={row.key}>
              <DataTableCell label={what}>
                {row.what}
                <span className="block text-note text-muted-foreground">{row.where}</span>
              </DataTableCell>
              <DataTableCell label={why}>{row.why}</DataTableCell>
              <DataTableCell label={kept}>{row.kept}</DataTableCell>
            </DataTableRow>
          ))}
        </DataTableBody>
      </DataTable>

      <RegionBody className="flex flex-col gap-1 border-t border-border">
        <h3 className="m-0 text-body font-semibold">{__('Sent to other services', 'wconvert')}</h3>
        {data.destinations.length === 0 && (
          <Description>
            {__('No destinations are set up, so submissions stay in WConvert unless you export them.', 'wconvert')}{' '}
            <a className="underline underline-offset-2" href={settingsHref('connections')}>
              {__('Set up a destination', 'wconvert')}
            </a>
          </Description>
        )}
      </RegionBody>
      {recipients.length > 0 && (
        <DataTable label={__('Sent to other services', 'wconvert')}>
          <DataTableHead>
            <DataTableColumn>{service}</DataTableColumn>
            <DataTableColumn>{receives}</DataTableColumn>
          </DataTableHead>
          <DataTableBody>
            {recipients.map((row) => (
              <DataTableRow key={row.key}>
                <DataTableCell label={service}>
                  <span className="font-medium">{row.name}</span>
                  {row.service && <span className="block text-note text-muted-foreground">{row.service}</span>}
                </DataTableCell>
                <DataTableCell label={receives}>{row.receives}</DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      )}

      <RegionBody className="flex flex-col gap-3 border-t border-border">
        <Description>
          {__('Deleting from WConvert doesn’t delete copies at these services, in CSV exports, email logs or backups. For a deletion request, remove those separately.', 'wconvert')}{' '}
          {data.destinations.length > 0 && (
            <a className="underline underline-offset-2" href={settingsHref('connections')}>
              {__('Review destinations', 'wconvert')}
            </a>
          )}
        </Description>
        <Disclosure variant="inline" title={__('More detail', 'wconvert')}>
          <ul className="m-0 grid list-disc gap-2 ps-5 text-note text-muted-foreground">
            <li>{__('Submissions don’t include the page address, IP address or browser details.', 'wconvert')}</li>
            <li>
              {sprintf(
                /* translators: %s: how long the fallback cookie lasts, e.g. “365 days”. */
                __('If the browser blocks storage, a cookie keeps the display history for up to %s. Neither holds contact details or a visitor ID.', 'wconvert'),
                days(data.browser.cookie_fallback_days),
              )}
            </li>
            <li>{__('Per-session counts keep at most 128 campaigns, dropping the least recently shown first. Browsers may restore a tab’s session storage with the tab.', 'wconvert')}</li>
            {data.browser.content_unlock != null && <li>{__('Content locks remember at most 64 campaigns. When storage is blocked, an unlock lasts for that page only.', 'wconvert')}</li>}
            {data.browser.cart_recovery !== null && <li>{__('Cart rules read the existing WooCommerce session and keep matches in page memory for up to 30 seconds. Cart reads are rate-limited for one minute by a one-way IP code.', 'wconvert')}</li>}
            <li>{__('Expired one-way codes are removed during scheduled maintenance.', 'wconvert')}</li>
            {data.browser.additional?.map((note) => <li key={note}>{note}</li>)}
          </ul>
        </Disclosure>
      </RegionBody>
    </Region>
  );
}
