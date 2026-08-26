import { useCallback, useEffect, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import {
  deleteDestination,
  readDestinations,
  rePush,
  saveDestination,
  type Destination,
  type DestinationType,
  type DestinationsPayload,
  type RePushReport,
} from './api';
import { renderingFor } from '../goals/availability';

const EMPTY: DestinationsPayload = { types: [], destinations: [], connections: [], failures: [] };

/**
 * **Where a merchant finds out whether pushing is working.**
 *
 * That is the screen's whole reason to exist. A merchant whose integration
 * broke three days ago has no other way to notice: the [[Lead]]s are in the
 * log, the [[Optin]] is still converting, and nothing else anywhere says the
 * pushes stopped.
 *
 * **What it shows is per-[[Destination]] health and a bounded ring of terminal
 * failures — never a per-Lead delivery column.** There is no such column and
 * there is not going to be one: `push()` is idempotent, so per-Lead delivery
 * state buys efficiency rather than correctness, and health plus a re-push
 * button answers the actual support case (ADR 0008).
 *
 * The two failure displays are not redundant. `consecutive_failures` counts
 * OUTAGES; a Lead rejected for its own sake — a malformed address — leaves it
 * at zero and lands in the ring instead. Showing only one of them would hide
 * exactly one of the two things that go wrong.
 */
export function Destinations() {
  const [payload, setPayload] = useState<DestinationsPayload>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<RePushReport | null>(null);

  const say = (cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause));

  const refresh = useCallback(async () => {
    try {
      setPayload(await readDestinations());
      setError(null);
    } catch (cause) {
      say(cause);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = (type: DestinationType) => {
    setBusy(true);

    void (async () => {
      try {
        await saveDestination({ type: type.id, label: type.label, settings: {} });
        await refresh();
      } catch (cause) {
        say(cause);
      } finally {
        setBusy(false);
      }
    })();
  };

  const remove = (destination: Destination) => {
    setBusy(true);

    void (async () => {
      try {
        setPayload({ ...payload, destinations: (await deleteDestination(destination.id)).destinations });
        await refresh();
      } catch (cause) {
        say(cause);
      } finally {
        setBusy(false);
      }
    })();
  };

  const replay = (destination: Destination) => {
    setBusy(true);

    void (async () => {
      try {
        setReport(await rePush(destination.id));
      } catch (cause) {
        say(cause);
      } finally {
        setBusy(false);
      }
    })();
  };

  const save = (destination: Destination, settings: Record<string, unknown>) => {
    setBusy(true);

    void (async () => {
      try {
        await saveDestination({
          id: destination.id,
          type: destination.type,
          label: destination.label,
          connection: destination.connection,
          settings,
        });
        await refresh();
      } catch (cause) {
        say(cause);
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <section className="wconvert-destinations">
      <h2>{__('Destinations', 'wconvert')}</h2>

      {error !== null && (
        <div className="notice notice-error">
          <p>{error}</p>
        </div>
      )}

      <p className="description">
        {__(
          'Where a captured Lead is sent on to. The Lead log is not one — it is written first and always, whatever happens here.',
          'wconvert'
        )}
      </p>

      <Types types={payload.types} configured={payload.destinations} busy={busy} onAdd={add} />

      {payload.destinations.map((destination) => (
        <Configured
          key={destination.id}
          destination={destination}
          field={payload.types.find((type) => type.id === destination.type)?.settings_schema?.tags}
          busy={busy}
          onSave={save}
          onRemove={remove}
          onRePush={replay}
        />
      ))}

      {report !== null && <RePushNotice report={report} />}

      <Failures failures={payload.failures} />
    </section>
  );
}

/**
 * The types this install can reach.
 *
 * `unavailable` is explained and never sold: a merchant with no WP SMS is not
 * missing something we can sell them, and rendering that as an upsell is what
 * ADR 0026 exists to stop.
 */
function Types({
  types,
  configured,
  busy,
  onAdd,
}: {
  types: DestinationType[];
  configured: Destination[];
  busy: boolean;
  onAdd: (type: DestinationType) => void;
}) {
  if (types.length === 0) {
    return <p className="description">{__('No Destination types are available on this site.', 'wconvert')}</p>;
  }

  return (
    <ul className="wconvert-destinations__types">
      {types.map((type) => {
        const rendering = renderingFor(type.availability, 'settings_list');

        return (
        <li key={type.id}>
          <span className={`dashicons ${type.icon}`} aria-hidden="true" />{' '}
          <strong>{type.label}</strong>{' '}
          {/*
            This is a SETTINGS LIST, so it explains an absence rather than
            hiding it — the merchant opened this page expecting a list, and
            silence here is baffling. The cascade is `renderingFor`'s and not
            one written out again: `locked` and `unavailable` must never
            collapse into one "not available", because that is exactly how a
            paying customer gets shown an advertisement for Pro and a merchant
            gets offered a WP SMS licence we do not sell (ADR 0026).
          */}
          {rendering === 'offer' ? (
            <button
              type="button"
              className="button"
              disabled={busy || configured.some((destination) => destination.type === type.id)}
              onClick={() => onAdd(type)}
            >
              {__('Add', 'wconvert')}
            </button>
          ) : rendering === 'upsell' ? (
            <span className="description">{__('Included with Pro.', 'wconvert')}</span>
          ) : (
            <span className="description">
              {sprintf(
                /* translators: %s: the plugin or platform the Destination needs, e.g. "WP SMS". */
                __('Needs %s on this site.', 'wconvert'),
                type.requires_label ?? __('something this site does not have', 'wconvert')
              )}
            </span>
          )}
        </li>
        );
      })}
    </ul>
  );
}

/** One configured Destination, its health, and the one recovery action. */
function Configured({
  destination,
  field,
  busy,
  onSave,
  onRemove,
  onRePush,
}: {
  destination: Destination;
  /** The `tags` field as its TYPE declares it — copy included. */
  field: DestinationType['settings_schema'][string] | undefined;
  busy: boolean;
  onSave: (destination: Destination, settings: Record<string, unknown>) => void;
  onRemove: (destination: Destination) => void;
  onRePush: (destination: Destination) => void;
}) {
  const tags = Array.isArray(destination.settings.tags) ? (destination.settings.tags as string[]) : [];
  const [draft, setDraft] = useState(tags.join(', '));
  const failing = destination.health.consecutive_failures > 0;

  return (
    <div className="wconvert-destinations__row">
      <h3>
        {destination.label}{' '}
        {destination.availability === 'locked' && (
          <span className="description">
            {__('Its type is a Pro feature this install does not have, so captures are not being sent.', 'wconvert')}
          </span>
        )}
        {destination.availability === 'unavailable' && (
          <span className="description">
            {__('What it needs is not on this site, so captures are not being sent.', 'wconvert')}
          </span>
        )}
      </h3>

      <p className={failing ? 'notice notice-warning' : 'description'}>
        {failing
          ? sprintf(
              /* translators: 1: number of failures in a row, 2: the last error. */
              _n(
                '%1$d failure in a row. Last error: %2$s',
                '%1$d failures in a row. Last error: %2$s',
                destination.health.consecutive_failures,
                'wconvert'
              ),
              destination.health.consecutive_failures,
              destination.health.last_error ?? ''
            )
          : destination.health.last_success_at === null
            ? __('Nothing has been pushed here yet.', 'wconvert')
            : sprintf(
                /* translators: %s: a date and time. */
                __('Last successful push: %s', 'wconvert'),
                destination.health.last_success_at
              )}
      </p>

      {destination.health.skipped_captures > 0 && (
        <p className="notice notice-warning">
          {sprintf(
            /* translators: 1: number of captures, 2: a date and time. */
            _n(
              '%1$d capture was not sent, most recently at %2$s. Fix what this Destination needs, then re-push.',
              '%1$d captures were not sent, most recently at %2$s. Fix what this Destination needs, then re-push.',
              destination.health.skipped_captures,
              'wconvert'
            ),
            destination.health.skipped_captures,
            destination.health.last_skipped_at ?? ''
          )}
        </p>
      )}

      <p>
        <label>
          {/*
            The label comes from the TYPE's `settingsSchema()`, which is what
            replaces WSMS's five `Supports*` capability interfaces: a
            Destination's fields are a schema rather than a capability, so
            there is one method and no matrix (#4).
          */}
          {field?.label ?? __('Tags to add', 'wconvert')}{' '}
          <input
            type="text"
            className="regular-text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </label>{' '}
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={() =>
            onSave(destination, {
              ...destination.settings,
              tags: draft
                .split(',')
                .map((tag) => tag.trim())
                .filter((tag) => tag !== ''),
            })
          }
        >
          {__('Save', 'wconvert')}
        </button>
        {field?.description !== undefined && <span className="description"> {field.description}</span>}
      </p>

      <p>
        <button type="button" className="button" disabled={busy} onClick={() => onRePush(destination)}>
          {__('Re-push Leads since the last success', 'wconvert')}
        </button>{' '}
        <button type="button" className="button-link-delete" disabled={busy} onClick={() => onRemove(destination)}>
          {__('Remove', 'wconvert')}
        </button>
      </p>
    </div>
  );
}

/** What the replay queued — including, out loud, whether it was truncated. */
function RePushNotice({ report }: { report: RePushReport }) {
  return (
    <div className={report.capped ? 'notice notice-warning' : 'notice notice-success'}>
      <p>
        {sprintf(
          /* translators: %d: number of pushes queued. */
          _n('%d Lead queued for re-pushing.', '%d Leads queued for re-pushing.', report.jobs, 'wconvert'),
          report.jobs
        )}{' '}
        {report.capped && __('That is the per-run limit — run it again once these have gone through.', 'wconvert')}
      </p>
    </div>
  );
}

/**
 * The terminal-failure ring.
 *
 * These are the Leads that will never land, and **health cannot see them** —
 * a malformed address is not an outage, so it leaves `consecutive_failures` at
 * zero. Without this list there would be nothing anywhere naming them
 * (ADR 0008).
 */
function Failures({ failures }: { failures: DestinationsPayload['failures'] }) {
  if (failures.length === 0) {
    return null;
  }

  return (
    <>
      <h3>{__('Leads that could not be delivered', 'wconvert')}</h3>
      <p className="description">
        {__(
          'These failed for their own sake rather than because a Destination was down, so they are not counted as outages. The most recent 200 are kept.',
          'wconvert'
        )}
      </p>
      <table className="widefat striped">
        <thead>
          <tr>
            <th>{__('When', 'wconvert')}</th>
            <th>{__('Lead', 'wconvert')}</th>
            <th>{__('Why', 'wconvert')}</th>
          </tr>
        </thead>
        <tbody>
          {failures.map((failure) => (
            <tr key={`${failure.lead}-${failure.at}`}>
              <td>{failure.at}</td>
              <td>
                <code>{failure.lead}</code>
              </td>
              <td>{failure.error}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
