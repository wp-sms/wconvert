import { useEffect, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { settingsHref } from '../nav';
import { Description } from '../shell/Description';
import { Region, RegionBody, RegionErrorState, RegionHeader } from '../shell/Region';
import { RegionSkeleton } from '../shell/RegionSkeleton';
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

  useEffect(() => {
    let active = true;
    void readDataMap()
      .then((data) => { if (active) setState(ready(data)); })
      .catch((cause) => { if (active) setState(failed(cause)); });
    return () => { active = false; };
  }, []);

  if (state.status === 'loading') {
    return <RegionSkeleton label={__('Where visitor data goes', 'wconvert')} lines={5} />;
  }

  if (state.status === 'failed') {
    return (
      <Region>
        <RegionHeader
          title={__('Where visitor data goes', 'wconvert')}
          description={__('See what WConvert saves, what stays in a visitor’s browser and which copies you must manage elsewhere.', 'wconvert')}
        />
        <RegionErrorState message={state.message} />
      </Region>
    );
  }

  const data = state.data;

  return (
    <Region>
      <RegionHeader
        title={__('Where visitor data goes', 'wconvert')}
        description={__('See what WConvert saves, what stays in a visitor’s browser and which copies you must manage elsewhere.', 'wconvert')}
      />
      <RegionBody className="flex flex-col gap-5">
        <section aria-labelledby="wconvert-stored-data">
          <h3 id="wconvert-stored-data" className="m-0 text-body font-medium">
            {__('Saved in WConvert', 'wconvert')}
          </h3>
          <Description className="mt-1">
            {__('WConvert saves the information a visitor enters in a form. This can include their name, email address, phone number, answers and the consent wording they saw. Each submission also records which Campaign collected it and when. It does not include the page URL, IP address or browser details.', 'wconvert')}
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
            {__('A visitor’s browser remembers whether they saw, dismissed or completed a Campaign, and which A/B test version they received. WConvert does not set an expiry for this local-storage record; it stays until the visitor or browser clears it.', 'wconvert')}
          </Description>
          <Description className="mt-2">
            {sprintf(
              /* translators: %s: the fallback cookie lifetime in days. */
              __('If local storage is unavailable, a cookie keeps the same information for up to %s. Neither record contains contact details or a WConvert visitor ID.', 'wconvert'),
              cookieDurationText(data.browser.cookie_fallback_days),
            )}
          </Description>
        </section>

        <section aria-labelledby="wconvert-anonymous-counts" className="border-t border-border pt-5">
          <h3 id="wconvert-anonymous-counts" className="m-0 text-body font-medium">
            {__('Anonymous campaign totals', 'wconvert')}
          </h3>
          <Description className="mt-1">
            {__('WConvert keeps daily totals of Campaign views, dismissals and completions. These totals are not linked to individual visitors.', 'wconvert')}
          </Description>
          <Description className="mt-2">
            {sprintf(
              /* translators: %s: a short duration such as “one minute”. */
              __('To avoid counting the same activity repeatedly, WConvert keeps a one-way code made from the visitor’s IP address for %s. The code then expires, and the IP address itself is not saved.', 'wconvert'),
              rateLimitText(data.beacon_rate_limit_seconds),
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
            {__('Deleting a submission from WConvert does not delete copies already sent to other services or saved in CSV exports, email logs or backups. If someone asks you to delete their data, remove those copies from each place too.', 'wconvert')}
          </Description>
        </section>
      </RegionBody>
    </Region>
  );
}
