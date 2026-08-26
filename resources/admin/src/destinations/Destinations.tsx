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
      {types.map((type) => (
        <li key={type.id}>
          <span className={`dashicons ${type.icon}`} aria-hidden="true" />{' '}
          <strong>{type.label}</strong>{' '}
          {type.availability === 'ready' ? (
            <button
              type="button"
              className="button"
              disabled={busy || configured.some((destination) => destination.type === type.id)}
              onClick={() => onAdd(type)}
            >
              {__('Add', 'wconvert')}
            </button>
          ) : (
            <span className="description">
              {type.availability === 'unavailable'
                ? sprintf(
                    /* translators: %s: the plugin or platform the Destination needs. */
                    __('Needs %s on this site.', 'wconvert'),
                    type.requires ?? __('something this site does not have', 'wconvert')
                  )
                : __('Included with Pro.', 'wconvert')}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** One configured Destination, its health, and the one recovery action. */
function Configured({
  destination,
  busy,
  onSave,
  onRemove,
  onRePush,
}: {
  destination: Destination;
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
        {destination.availability !== 'ready' && (
          <span className="description">{__('Not running on this site right now.', 'wconvert')}</span>
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

      <p>
        <label>
          {/*
            Tags, not lists. `wsms_lists` is a segment DEFINITION whose
            membership is a query — there is nothing to insert into — and
            membership WConvert adds is only ever ADDED, never reconciled
            (ADR 0023).
          */}
          {__('Tags to add (comma separated ids)', 'wconvert')}{' '}
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
