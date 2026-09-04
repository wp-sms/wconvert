import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { Description } from '../shell/Description';
import {
  Region,
  RegionBody,
  RegionError,
  RegionErrorState,
  RegionHeader,
} from '../shell/Region';
import { LOADING, failed, messageOf, ready, type Loadable } from '../shell/loadable';
import { readSiteAllowance, saveSiteAllowance, type SiteAllowance as Allowance } from './api';

/**
 * *How often anything shows* — the allowance the whole site shares.
 *
 * ============================================================================
 * A SECOND REGION ON THIS SCREEN, FOR THE REASON RETENTION IS ONE ON LEADS.
 * ============================================================================
 * The list above is one object — what exists, and what is on the site. This is
 * another: how often a visitor may meet ANY of them. Two concerns are two
 * regions and the edge between them is what says so (ADR 0039). It is not a
 * section of its own for the same reason retention is not: it is one question
 * about the rows here, and a tab holding four fields reads as a screen somebody
 * forgot to finish (`nav.ts`).
 *
 * ============================================================================
 * ALL FOUR ARE OFF UNTIL ASKED FOR, AND THAT IS THE OPPOSITE OF THE BUILDER'S.
 * ============================================================================
 * `builder/rules/HowOften.tsx` draws the same four fields for ONE Optin, with
 * both switches on by default, and this must not copy that. *One dismissal
 * silences the entire site for a week* is a claim about what the visitor meant
 * that they did not make, and a merchant who never asked for it would
 * experience it as the plugin having stopped working (ADR 0047).
 *
 * So the shipped state of this card is four empty controls, and a site in that
 * state carries no allowance on any page and writes no record on any visitor's
 * device.
 *
 * ============================================================================
 * IT IS A VETO, AND THE CARD SAYS SO.
 * ============================================================================
 * An Optin cannot opt out — a per-Optin *ignore the site setting* is the
 * configuration two scopes exist to delete — so a merchant who sets something
 * here has overridden every Optin's own allowance at once. That is the one
 * thing they cannot discover by reading any other screen, so it is the
 * description on the header rather than a note underneath.
 */
export function SiteAllowance() {
  const [allowance, setAllowance] = useState<Loadable<Allowance>>(LOADING);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /*
   * The two numbers are committed on blur or Enter, never on every keystroke —
   * the same rule the retention period follows and for a softer version of its
   * reason. Typing `10` passes through `1`, and a saved 1 is a site-wide cap of
   * one impression that takes effect on the next page view of every visitor.
   */
  const [drafts, setDrafts] = useState<{ maxImpressions: string; cooldownDays: string }>({
    maxImpressions: '',
    cooldownDays: '',
  });

  useEffect(() => {
    readSiteAllowance()
      .then((current) => {
        setAllowance(ready(current));
        setDrafts(draftsOf(current));
      })
      .catch((cause: unknown) => setAllowance(failed(cause)));
  }, []);

  const current = allowance.status === 'ready' ? allowance.data : null;

  const commit = (next: Allowance) => {
    setBusy(true);

    void (async () => {
      try {
        const saved = await saveSiteAllowance(next);

        setAllowance(ready(saved));
        setDrafts(draftsOf(saved));
        setError(null);
      } catch (cause) {
        setError(messageOf(cause));
      } finally {
        setBusy(false);
      }
    })();
  };

  /**
   * Commit a typed number, or leave everything alone.
   *
   * An emptied box is *no limit* rather than zero — the same reading
   * `HowOften.tsx` takes and the same one `src/Optin/Frequency.php` takes of a
   * count it cannot use. A draft that is not a usable number is neither saved
   * nor silently corrected: the field keeps what was typed, and the stored
   * allowance keeps what it had.
   */
  const commitDraft = (field: 'maxImpressions' | 'cooldownDays') => {
    if (current === null) {
      return;
    }

    const typed = drafts[field];
    const count = Number(typed);
    const next = typed === '' ? null : Number.isInteger(count) && count >= 1 ? count : undefined;

    if (next === undefined || next === current[field]) {
      return;
    }

    commit({ ...current, [field]: next });
  };

  return (
    <Region>
      <RegionHeader
        title={__('How often anything shows', 'wconvert')}
        description={__(
          'This applies to every Optin above, on top of each one’s own settings. Left alone, only each Optin’s own settings apply.',
          'wconvert',
        )}
      />

      {allowance.status === 'failed' ? (
        <RegionErrorState
          message={allowance.message}
          hint={__('Reload the page to try again.', 'wconvert')}
        />
      ) : (
        <>
          {error !== null && <RegionError message={error} />}

          <RegionBody>
            <div className="wconvert-allowance">
              <label className="wconvert-allowance__switch text-body">
                <input
                  type="checkbox"
                  checked={current?.stopAfterDismiss === true}
                  disabled={busy || current === null}
                  onChange={(event) =>
                    current !== null &&
                    commit({ ...current, stopAfterDismiss: event.target.checked })
                  }
                />{' '}
                {__('Once they close any Optin, show them nothing else', 'wconvert')}
              </label>

              <label className="wconvert-allowance__switch text-body">
                <input
                  type="checkbox"
                  checked={current?.stopAfterConversion === true}
                  disabled={busy || current === null}
                  onChange={(event) =>
                    current !== null &&
                    commit({ ...current, stopAfterConversion: event.target.checked })
                  }
                />{' '}
                {__('Once they sign up to anything, show them nothing else', 'wconvert')}
              </label>

              <label htmlFor="wconvert-site-max">
                {__('Show at most this many in total', 'wconvert')}
              </label>
              <input
                id="wconvert-site-max"
                type="number"
                className="small-text"
                min={1}
                value={drafts.maxImpressions}
                disabled={busy || current === null}
                onChange={(event) =>
                  setDrafts((held) => ({ ...held, maxImpressions: event.target.value }))
                }
                onBlur={() => commitDraft('maxImpressions')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    commitDraft('maxImpressions');
                  }
                }}
              />
              <Description as="span">{__('Empty means no limit.', 'wconvert')}</Description>

              <label htmlFor="wconvert-site-cooldown">
                {__('Days to wait between any two', 'wconvert')}
              </label>
              <input
                id="wconvert-site-cooldown"
                type="number"
                className="small-text"
                min={1}
                value={drafts.cooldownDays}
                disabled={busy || current === null}
                onChange={(event) =>
                  setDrafts((held) => ({ ...held, cooldownDays: event.target.value }))
                }
                onBlur={() => commitDraft('cooldownDays')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    commitDraft('cooldownDays');
                  }
                }}
              />
              <Description as="span">{__('Empty means no wait.', 'wconvert')}</Description>
            </div>
          </RegionBody>
        </>
      )}
    </Region>
  );
}

const draftsOf = (allowance: Allowance) => ({
  maxImpressions: allowance.maxImpressions === null ? '' : String(allowance.maxImpressions),
  cooldownDays: allowance.cooldownDays === null ? '' : String(allowance.cooldownDays),
});
