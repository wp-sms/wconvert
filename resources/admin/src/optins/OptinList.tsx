import { useCallback, useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import {
  createOptin,
  deleteOptin,
  listOptins,
  publishOptin,
  statusOf,
  unpublishOptin,
  type OptinSummary,
} from './api';

/**
 * The Optin list.
 *
 * Deliberately the thinnest surface that makes an Optin creatable, targetable
 * and publishable. The builder — templates, playbooks, the goal-first creation
 * flow — arrives in its own ticket, and guessing at it here would be writing
 * the shape before its subject.
 *
 * Targeting is edited as raw JSON for exactly that reason: a page picker is a
 * builder component, and a textarea is honest about being a placeholder in a
 * way a half-built picker would not be.
 */
const STARTING_CONFIG = JSON.stringify(
  { targeting: { include: [{ type: 'url', value: '/*' }] } },
  null,
  2,
);

export function OptinList() {
  const [optins, setOptins] = useState<OptinSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('grow_email_list');
  const [config, setConfig] = useState(STARTING_CONFIG);

  const refresh = useCallback(async () => {
    try {
      setOptins(await listOptins());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);

    try {
      await action();
      await refresh();
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();

    let parsed: Record<string, unknown>;

    try {
      parsed = JSON.parse(config) as Record<string, unknown>;
    } catch {
      setError(__('The configuration is not valid JSON.', 'wconvert'));
      return;
    }

    void run(async () => {
      await createOptin(name, goal, parsed);
      setName('');
    });
  };

  return (
    <>
      {error !== null && (
        <div className="notice notice-error">
          <p>{error}</p>
        </div>
      )}

      <h2>{__('Optins', 'wconvert')}</h2>

      <table className="wp-list-table widefat fixed striped">
        <thead>
          <tr>
            <th>{__('Name', 'wconvert')}</th>
            <th>{__('Goal', 'wconvert')}</th>
            <th>{__('Status', 'wconvert')}</th>
            <th>{__('Actions', 'wconvert')}</th>
          </tr>
        </thead>
        <tbody>
          {optins.length === 0 && (
            <tr>
              <td colSpan={4}>{__('No Optins yet.', 'wconvert')}</td>
            </tr>
          )}
          {optins.map((optin) => {
            const status = statusOf(optin);

            return (
              <tr key={optin.id}>
                <td>{optin.name}</td>
                <td>
                  <code>{optin.goal}</code>
                </td>
                <td>{status}</td>
                <td>
                  {status === 'published' ? (
                    <button
                      type="button"
                      className="button"
                      disabled={busy}
                      onClick={() => void run(() => unpublishOptin(optin.id))}
                    >
                      {__('Unpublish', 'wconvert')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="button button-primary"
                      disabled={busy}
                      onClick={() => void run(() => publishOptin(optin.id))}
                    >
                      {__('Publish', 'wconvert')}
                    </button>
                  )}{' '}
                  <button
                    type="button"
                    className="button button-link-delete"
                    disabled={busy}
                    onClick={() => void run(() => deleteOptin(optin.id))}
                  >
                    {__('Delete', 'wconvert')}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h2>{__('New Optin', 'wconvert')}</h2>

      <form onSubmit={submit}>
        <p>
          <label>
            {__('Name', 'wconvert')}{' '}
            <input type="text" value={name} required onChange={(e) => setName(e.target.value)} />
          </label>
        </p>
        <p>
          <label>
            {__('Goal', 'wconvert')}{' '}
            <input type="text" value={goal} required onChange={(e) => setGoal(e.target.value)} />
          </label>
        </p>
        <p>
          <label>
            {__('Configuration (JSON)', 'wconvert')}
            <br />
            <textarea rows={8} cols={60} value={config} onChange={(e) => setConfig(e.target.value)} />
          </label>
        </p>
        <p>
          <button type="submit" className="button button-primary" disabled={busy}>
            {__('Create', 'wconvert')}
          </button>
        </p>
      </form>
    </>
  );
}
