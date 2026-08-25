import { useCallback, useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { listGoals } from '../goals/api';
import { deleteOptin, listOptins, publishOptin, statusOf, unpublishOptin, type OptinSummary } from './api';

/**
 * The Optin list: what exists, and what is on the site.
 *
 * **It does not create one.** Creation is the goal-first flow beside it: a
 * [[Goal]] is chosen before anything else is configured, and it is a registry
 * member subject to [[Availability]] rather than a string somebody types
 * (ADR 0026). The free-text field this list used to carry was a placeholder
 * for exactly that flow, and a second door into creation that skipped the
 * registry is precisely the drift the registry exists to stop.
 *
 * Targeting and the rest of an Optin's configuration belong to the builder,
 * which arrives in its own ticket.
 */
export function OptinList() {
  const [optins, setOptins] = useState<OptinSummary[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  // The row stores a [[Goal]]'s id and the merchant reads its label, so the
  // registry is fetched once and the rows are labelled from it. Fetched rather
  // than spelled here: the five live in one PHP enum, their labels are
  // translatable strings `wp i18n make-pot` can only see there, and naming one
  // in this bundle is what `tests/unit/Goal/GoalParityTest.php` fails on.
  //
  // Its own error is swallowed on purpose. A registry that did not load costs
  // this screen a nicer word for a Goal; it must not cost the merchant the
  // publish and delete buttons beside it, and `refresh()` reports the failure
  // that would.
  useEffect(() => {
    listGoals()
      .then((goals) => setLabels(Object.fromEntries(goals.map((goal) => [goal.id, goal.label]))))
      .catch(() => undefined);
  }, []);

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
                {/*
                  An id with no label is an Optin holding a Goal this build
                  does not have — a `<code>` rather than a blank, because the
                  raw value is the only honest thing left to show and blanking
                  it would read as an Optin with no Goal at all.
                */}
                <td>{labels[optin.goal] ?? <code>{optin.goal}</code>}</td>
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
    </>
  );
}
