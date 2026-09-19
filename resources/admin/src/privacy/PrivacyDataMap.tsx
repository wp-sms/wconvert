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
  ? __('Submissions are kept until you delete them. Automatic deletion is not enabled.', 'wconvert')
  : sprintf(
    /* translators: %s: configured retention period, already pluralized. */
    __('Submissions are deleted automatically after %s.', 'wconvert'),
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
    return <RegionSkeleton label={__('Your data flow', 'wconvert')} lines={4} />;
  }

  if (state.status === 'failed') {
    return (
      <Region>
        <RegionHeader
          title={__('Your data flow', 'wconvert')}
          description={__('What this site keeps and where configured copies can go.', 'wconvert')}
        />
        <RegionErrorState message={state.message} />
      </Region>
    );
  }

  const data = state.data;

  return (
    <Region>
      <RegionHeader
        title={__('Your data flow', 'wconvert')}
        description={__('What this site keeps and where configured copies can go.', 'wconvert')}
      />
      <RegionBody className="flex flex-col gap-5">
        <section aria-labelledby="wconvert-stored-data">
          <h3 id="wconvert-stored-data" className="m-0 text-body font-medium">
            {__('Stored by WConvert', 'wconvert')}
          </h3>
          <Description className="mt-1">
            {__('A submission can contain an email address, phone number, name, form answers and consent wording, together with its Campaign and submission time. WConvert does not attach the page address, network address or browser details to the submission.', 'wconvert')}
          </Description>
          {data.retention_days === null ? (
            <Alert className="mt-3 border-warning/30 bg-warning/5 text-warning">
              <TriangleAlert />
              <AlertTitle className="line-clamp-none">{__('No automatic deletion', 'wconvert')}</AlertTitle>
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
            {__('Browser and anonymous counts', 'wconvert')}
          </h3>
          <Description className="mt-1">
            {__('The visitor’s browser keeps display, dismissal, conversion and optional A/B assignment state in local storage, with a cookie fallback. It contains no contact details and no WConvert-generated visitor identifier.', 'wconvert')}
          </Description>
          <Description className="mt-2">
            {sprintf(
              /* translators: %s: a short duration such as “one minute”. */
              __('For anonymous campaign counting, a site-specific one-way hash derived from the network address is kept for %s. The network address itself is not stored.', 'wconvert'),
              rateLimitText(data.beacon_rate_limit_seconds),
            )}
          </Description>
        </section>

        <section aria-labelledby="wconvert-destination-data" className="border-t border-border pt-5">
          <h3 id="wconvert-destination-data" className="m-0 text-body font-medium">
            {__('Configured destinations', 'wconvert')}
          </h3>
          {data.destinations.length === 0 ? (
            <div className="mt-2 rounded-md border border-dashed border-border p-4">
              <p className="m-0 text-body">{__('No destinations are configured. Submissions stay in WConvert unless an administrator exports them.', 'wconvert')}</p>
              <a className="mt-2 inline-block text-note underline underline-offset-2" href={settingsHref('connections')}>
                {__('Set up destinations', 'wconvert')}
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
                      {__('This destination type is not available here, so its data details could not be read. Review or remove it under Connections & destinations.', 'wconvert')}
                    </Description>
                  ) : (
                    <Description className="mt-1">
                      {sprintf(
                        /* translators: %s: comma-separated personal-data fields. */
                        __('May receive: %s', 'wconvert'),
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
            {__('Copies outside WConvert', 'wconvert')}
          </h3>
          <Description className="mt-1">
            {__('Deleting a WConvert submission does not remove CSV files, destination copies, email logs or backups. Review and delete those separately when a request requires it.', 'wconvert')}
          </Description>
        </section>
      </RegionBody>
    </Region>
  );
}
