import { useCallback, useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { listGoals } from '../goals/api';
import {
  deleteOptin,
  canUnpublish,
  listOptins,
  publishOptin,
  statusOf,
  unpublishOptin,
  type OptinSummary,
} from './api';

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
 * which each row opens. Publishing stays HERE rather than moving in there
 * with them: `config` is the working draft and `published_config` is what the
 * site is serving, and the two are separate columns so that editing an Optin
 * is not publishing as you type. A publish button inside the editor would be
 * the same conflation wearing a different hat.
 */
export function OptinList({ onEdit }: { onEdit: (id: string) => void }) {
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
                {/*
                  **The state AND its cause, never the state alone.**
                  [[Suspended]] is not a state the merchant chose, so a bare
                  word here is a merchant with nowhere to ask why their popup
                  stopped — and this is the screen they come to when it does
                  (ADR 0027). The sentence is PHP's, already translated.

                  Branched on the STATE rather than on the sentence's presence,
                  so `statusOf` stays the one place a row's state is decided.
                  Reading `optin.suspended` directly here would be a second way
                  of asking, and the two would eventually answer differently.
                */}
                <td>{status === 'suspended' ? optin.suspended : status}</td>
                <td>
                  <button type="button" className="button" onClick={() => onEdit(optin.id)}>
                    {__('Edit', 'wconvert')}
                  </button>{' '}
                  {/*
                    A suspended Optin is published — the site is holding it
                    back, the merchant did not. So it keeps Unpublish rather
                    than being offered a Publish it never needed, which would
                    read as "this never went live".
                  */}
                  {canUnpublish(status) ? (
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
