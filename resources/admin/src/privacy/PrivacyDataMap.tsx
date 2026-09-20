import { useEffect, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { settingsHref } from '../nav';
import { Description } from '../shell/Description';
import { RegionBody, RegionErrorState } from '../shell/Region';
import { SettingsDisclosure } from '../shell/SettingsDisclosure';
import { failed, LOADING, ready, type Loadable } from '../shell/loadable';
import { readDataMap, type PrivacyDataMap as DataMap } from './api';

const FIELD_NAMES: Readonly<Record<string, string>> = {
  email: __('Email address', 'wconvert'),
  phone: __('Phone number', 'wconvert'),
  name: __('Name', 'wconvert'),
  interest: __('Interest answer', 'wconvert'),
};

const fieldName = (field: string) => FIELD_NAMES[field] ?? field;

const retentionText = (days: number | null) => days === null
  ? __('Automatic deletion is off.', 'wconvert')
  : sprintf(
    /* translators: %s: configured retention period, already pluralized. */
    __('Submissions are deleted automatically %s after they are submitted.', 'wconvert'),
    sprintf(
      /* translators: %s: number of days. */
      _n('%s day', '%s days', days, 'wconvert'),
      days.toLocaleString(),
    ),
  );

const rateLimitText = (seconds: number) => seconds === 60
  ? __('one minute', 'wconvert')
  : seconds % 60 === 0
    ? sprintf(
      /* translators: %s: number of minutes. */
      _n('%s minute', '%s minutes', seconds / 60, 'wconvert'),
      (seconds / 60).toLocaleString(),
    )
  : sprintf(
    /* translators: %s: number of seconds. */
    _n('%s second', '%s seconds', seconds, 'wconvert'),
    seconds.toLocaleString(),
  );

const cookieDurationText = (days: number) => days === 365
  ? __('one year', 'wconvert')
  : sprintf(
    /* translators: %s: number of days. */
    _n('%s day', '%s days', days, 'wconvert'),
    days.toLocaleString(),
  );

/** A read-only explanation of this install's actual personal-data boundaries. */
export function PrivacyDataMap() {
  const [state, setState] = useState<Loadable<DataMap>>(LOADING);
  const title = __('Where visitor data goes', 'wconvert');
  const summary = __('WConvert, browser storage, connected services, exports and backups.', 'wconvert');

  useEffect(() => {
    let active = true;
    void readDataMap()
      .then((data) => { if (active) setState(ready(data)); })
      .catch((cause) => { if (active) setState(failed(cause)); });
    return () => { active = false; };
  }, []);

  if (state.status === 'loading') {
    return (
      <SettingsDisclosure title={title} summary={summary}>
        <RegionBody className="flex flex-col gap-4">
          <span role="status" className="sr-only">{__('Loading…', 'wconvert')}</span>
          {Array.from({ length: 5 }, (_each, line) => (
            <Skeleton
              key={line}
              aria-hidden="true"
              className={line === 0 ? 'h-4 w-full max-w-md' : 'h-4 w-2/3 max-w-sm'}
            />
          ))}
        </RegionBody>
      </SettingsDisclosure>
    );
  }

  if (state.status === 'failed') {
    return (
      <SettingsDisclosure title={title} summary={summary} attention>
        <RegionErrorState message={state.message} />
      </SettingsDisclosure>
    );
  }

  const data = state.data;

  return (
    <SettingsDisclosure title={title} summary={summary}>
      <RegionBody className="flex flex-col gap-5">
        <section aria-labelledby="wconvert-stored-data">
          <h3 id="wconvert-stored-data" className="m-0 text-body font-medium">
            {__('Saved in WConvert', 'wconvert')}
          </h3>
          <Description className="mt-1">
            {__('Form submissions include answers, consent text, the Campaign, submission time and any name, email or phone entered. They do not include the page URL, IP address or browser details.', 'wconvert')}
          </Description>
          {data.retention_days === null ? (
            <Alert className="mt-3 border-warning/30 bg-warning/5 text-warning">
              <TriangleAlert />
              <AlertTitle className="line-clamp-none">{__('Kept until you delete them', 'wconvert')}</AlertTitle>
              <AlertDescription className="text-warning">
                {retentionText(null)}
              </AlertDescription>
            </Alert>
          ) : (
            <Description className="mt-2">{retentionText(data.retention_days)}</Description>
          )}
        </section>

        <section aria-labelledby="wconvert-browser-data" className="border-t border-border pt-5">
          <h3 id="wconvert-browser-data" className="m-0 text-body font-medium">
            {__('Saved in the visitor’s browser', 'wconvert')}
          </h3>
          <Description className="mt-1">
            {data.browser.stores_ab_assignment
              ? __('Browsers remember whether a visitor saw, dismissed or completed a Campaign, plus their A/B test version. This local storage stays until the visitor or browser clears it.', 'wconvert')
              : __('Browsers remember whether a visitor saw, dismissed or completed a Campaign. This local storage stays until the visitor or browser clears it.', 'wconvert')}
          </Description>
          <Description className="mt-2">
            {sprintf(
              /* translators: %s: the fallback cookie lifetime in days. */
              __('If local storage is unavailable, a cookie keeps the same data for up to %s. Neither record contains contact details or a WConvert visitor ID.', 'wconvert'),
              cookieDurationText(data.browser.cookie_fallback_days),
            )}
          </Description>
          {data.browser.content_unlock != null && <Description className="mt-2">{__('Content locks remember successful access for 30 days in site-scoped local storage: up to 64 Campaign IDs and expiry days, with no contact details. Blocked storage limits remembering to this page.', 'wconvert')}</Description>}
          {data.browser.reopen_session != null && <Description className="mt-2">{__('When a Pro reopen button is enabled, this tab also remembers the Campaign and reminder dismissals until its browser session ends. This session storage contains no contact details or visitor ID. Browsers may restore it when restoring tabs; blocked storage limits recovery to the current page.', 'wconvert')}</Description>}
          {data.browser.cart_recovery !== null && <Description className="mt-2">
            {__('Cart recovery keeps the cart item count and total until the WooCommerce cart session ends. It does not store product or contact details.', 'wconvert')}
          </Description>}
        </section>

        <section aria-labelledby="wconvert-activity-protection" className="border-t border-border pt-5">
          <h3 id="wconvert-activity-protection" className="m-0 text-body font-medium">
            {__('Campaign totals and form protection', 'wconvert')}
          </h3>
          <Description className="mt-1">
            {__('Daily Campaign totals record views, dismissals and completions, not individual visitors.', 'wconvert')}
          </Description>
          <Description className="mt-2">
            {sprintf(
              /* translators: %s: a short duration such as “one minute”. */
              __('To prevent duplicate counts, WConvert keeps a one-way code made from the IP address for %s. The code expires; the IP address is not saved.', 'wconvert'),
              rateLimitText(data.beacon_rate_limit_seconds),
            )}
          </Description>
          <Description className="mt-2">
            {sprintf(
              /* translators: %s: a short duration such as “10 minutes”. */
              __('To slow repeated form submissions, WConvert keeps a separate one-way IP code for each Campaign for %s. The IP address is not saved.', 'wconvert'),
              rateLimitText(data.capture_rate_limit_seconds),
            )}
          </Description>
        </section>

        <section aria-labelledby="wconvert-destination-data" className="border-t border-border pt-5">
          <h3 id="wconvert-destination-data" className="m-0 text-body font-medium">
            {__('Sent to other services', 'wconvert')}
          </h3>
          {data.destinations.length === 0 ? (
            <div className="mt-2 rounded-md border border-dashed border-border p-4">
              <p className="m-0 text-body">{__('No destinations are set up. Submissions stay in WConvert unless you export them.', 'wconvert')}</p>
              <a className="mt-2 inline-block text-note underline underline-offset-2" href={settingsHref('connections')}>
                {__('Set up a destination', 'wconvert')}
              </a>
            </div>
          ) : (
            <ul className="mb-0 mt-3 grid list-none gap-3 p-0">
              {data.destinations.map((destination) => (
                <li key={destination.id} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{destination.label}</span>
                    <Badge variant="secondary">{destination.type_label}</Badge>
                  </div>
                  {destination.fields === null ? (
                    <Description className="mt-1 text-warning">
                      {__('This saved destination is unavailable, so WConvert cannot show which information it receives. Review or remove it under Connections & destinations.', 'wconvert')}
                    </Description>
                  ) : (
                    <Description className="mt-1">
                      {sprintf(
                        /* translators: %s: comma-separated personal-data fields. */
                        __('Can receive: %s', 'wconvert'),
                        destination.fields.map(fieldName).join(', '),
                      )}
                    </Description>
                  )}
                </li>
              ))}
            </ul>
          )}
          {data.destinations.length > 0 && (
            <a className="mt-3 inline-block text-note underline underline-offset-2" href={settingsHref('connections')}>
              {__('Review destinations', 'wconvert')}
            </a>
          )}
        </section>

        <section aria-labelledby="wconvert-external-copies" className="border-t border-border pt-5">
          <h3 id="wconvert-external-copies" className="m-0 text-body font-medium">
            {__('Copies you must manage separately', 'wconvert')}
          </h3>
          <Description className="mt-1">
            {__('Deleting from WConvert does not delete copies in connected services, CSV exports, email logs or backups. For a deletion request, remove those copies separately.', 'wconvert')}
          </Description>
        </section>
      </RegionBody>
    </SettingsDisclosure>
  );
}
