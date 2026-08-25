import { useCallback, useEffect, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import {
  exportUrl,
  readLog,
  readRetention,
  saveRetention,
  type LeadLog as LeadLogPayload,
  type Retention,
} from './api';
import { listOptins, type OptinSummary } from '../optins/api';

/**
 * The [[Lead]] log.
 *
 * **The headline is submissions, and the grouping toggle does not move it.**
 * Collapsing Sarah's two rows into one reading "2 submissions" is a view on
 * the same log; it is never a second number the product reports. There is no
 * count of people on this screen and there is no honest one to put here —
 * identifiers are optional, so the number of groups counts identifiers seen,
 * which is a different quantity (ADR 0021).
 *
 * The Optin column shows the Optin's NAME, resolved from the list rather than
 * joined in SQL: an install has tens of Optins and thousands of Leads, so the
 * map is cheap and the join would be per-row. A soft-deleted Optin still has a
 * name, which is what the soft delete is for (ADR 0002, ADR 0020).
 */
const EMPTY: LeadLogPayload = { submissions: 0, grouped: false, leads: [], groups: [] };

export function LeadLog() {
  const [log, setLog] = useState<LeadLogPayload>(EMPTY);
  const [optins, setOptins] = useState<OptinSummary[]>([]);
  const [retention, setRetention] = useState<Retention | null>(null);
  const [optinId, setOptinId] = useState('');
  const [grouped, setGrouped] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const say = (cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause));

  const refresh = useCallback(async () => {
    try {
      setLog(await readLog(optinId, grouped));
      setError(null);
    } catch (cause) {
      say(cause);
    }
  }, [optinId, grouped]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void (async () => {
      try {
        // Deleted Optins included: a Lead outlives the Optin that captured it,
        // and a blank name on those rows is exactly where provenance matters.
        setOptins(await listOptins(true));
        setRetention(await readRetention());
      } catch (cause) {
        say(cause);
      }
    })();
  }, []);

  const nameOf = (id: string) => optins.find((optin) => optin.id === id)?.name ?? id;

  const changeRetention = (days: number | null) => {
    setBusy(true);

    void (async () => {
      try {
        setRetention(await saveRetention(days));
        setError(null);
      } catch (cause) {
        say(cause);
      } finally {
        setBusy(false);
      }
    })();
  };

  const csv = exportUrl(optinId);

  return (
    <>
      <h2>{__('Leads', 'wconvert')}</h2>

      {error !== null && (
        <div className="notice notice-error">
          <p>{error}</p>
        </div>
      )}

      {/*
        One number, and it says what it counts. "Leads" alone would invite the
        reading that this is a count of people, which it is not and cannot be.
      */}
      <p className="wconvert-lead-log__headline">
        <strong>
          {sprintf(
            /* translators: %s: a number of form submissions. */
            _n('%s submission', '%s submissions', log.submissions, 'wconvert'),
            String(log.submissions),
          )}
        </strong>
      </p>

      <p>
        <label>
          {__('Optin', 'wconvert')}{' '}
          <select value={optinId} onChange={(e) => setOptinId(e.target.value)}>
            <option value="">{__('All Optins', 'wconvert')}</option>
            {optins.map((optin) => (
              <option key={optin.id} value={optin.id}>
                {optin.name}
              </option>
            ))}
          </select>
        </label>{' '}
        <label>
          <input type="checkbox" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} />{' '}
          {__('Group submissions that share an email or phone', 'wconvert')}
        </label>{' '}
        {csv !== null && (
          <a className="button" href={csv}>
            {__('Export CSV', 'wconvert')}
          </a>
        )}
      </p>

      {grouped ? (
        <table className="wp-list-table widefat fixed striped">
          <thead>
            <tr>
              <th>{__('Identifier', 'wconvert')}</th>
              <th>{__('Submissions', 'wconvert')}</th>
              <th>{__('Last submitted', 'wconvert')}</th>
            </tr>
          </thead>
          <tbody>
            {log.groups.length === 0 && (
              <tr>
                <td colSpan={3}>{__('No leads yet.', 'wconvert')}</td>
              </tr>
            )}
            {log.groups.map((group) => (
              <tr key={group.identifier}>
                <td>{group.identifier}</td>
                <td>
                  {sprintf(
                    /* translators: %s: a number of form submissions. */
                    _n('%s submission', '%s submissions', group.submissions, 'wconvert'),
                    String(group.submissions),
                  )}
                </td>
                <td>{group.latest_at ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table className="wp-list-table widefat fixed striped">
          <thead>
            <tr>
              <th>{__('Submitted', 'wconvert')}</th>
              <th>{__('Optin', 'wconvert')}</th>
              <th>{__('Email', 'wconvert')}</th>
              <th>{__('Phone', 'wconvert')}</th>
              <th>{__('Captured', 'wconvert')}</th>
            </tr>
          </thead>
          <tbody>
            {log.leads.length === 0 && (
              <tr>
                <td colSpan={5}>{__('No leads yet.', 'wconvert')}</td>
              </tr>
            )}
            {log.leads.map((lead) => (
              <tr key={lead.id}>
                <td>{lead.created_at}</td>
                <td>{nameOf(lead.optin_id)}</td>
                <td>{lead.email ?? '—'}</td>
                <td>{lead.phone ?? '—'}</td>
                <td>
                  {Object.entries(lead.fields).map(([name, value]) => (
                    <div key={name}>
                      <code>{name}</code> {value}
                    </div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3>{__('How long leads are kept', 'wconvert')}</h3>

      {/*
        Keep-forever is the shipped default and the first option, because
        deleting a merchant's leads on the plugin's own opinion is a support
        catastrophe and may destroy records they must keep (ADR 0018).
      */}
      <p>
        <label>
          <input
            type="radio"
            name="wconvert-retention"
            checked={retention?.days === null}
            disabled={busy || retention === null}
            onChange={() => changeRetention(null)}
          />{' '}
          {__('Keep them until I delete them', 'wconvert')}
        </label>
      </p>
      <p>
        <label>
          <input
            type="radio"
            name="wconvert-retention"
            checked={typeof retention?.days === 'number'}
            disabled={busy || retention === null}
            onChange={() => changeRetention(90)}
          />{' '}
          {__('Delete them automatically after', 'wconvert')}{' '}
          <input
            type="number"
            min={1}
            max={retention?.max_days ?? 3650}
            value={retention?.days ?? ''}
            disabled={busy || retention === null || retention.days === null}
            onChange={(e) => changeRetention(Number(e.target.value))}
          />{' '}
          {__('days', 'wconvert')}
        </label>
      </p>
    </>
  );
}
