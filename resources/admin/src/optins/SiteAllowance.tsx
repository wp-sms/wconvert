import { useEffect, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { Description } from '../shell/Description';
import {
  RegionBody,
  RegionError,
  RegionErrorState,
} from '../shell/Region';
import { SettingsDisclosure } from '../shell/SettingsDisclosure';
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
  /*
   * What is typed in the two number fields, as typed. See {@link onScreen}:
   * these are the merchant's from the first read onwards, and every write
   * carries them.
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

  /**
   * **Everything the card is showing, as one allowance.**
   *
   * ==========================================================================
   * EVERY WRITE SENDS THE WHOLE THING, WHICH IS WHY NOTHING HAS TO BE LOCKED.
   * ==========================================================================
   * The obvious shape is one control, one field, and a `disabled` on the card
   * while a save is in flight. Both halves of that are wrong here, and they
   * fail together: clicking a switch BLURS the number beside it, so the
   * number's own save starts first and the `disabled` it sets swallows the
   * click that caused it. The merchant ticks a box and nothing happens.
   *
   * Sending what is on screen removes the reason to lock anything. Two writes
   * in flight both carry the merchant's whole answer, so the later one wins
   * and the later one is what they did last — where two partial writes built
   * from a stale `current` would have undone each other.
   *
   * The drafts are also seeded from the server ONCE, on the first read, and
   * are the merchant's from then on: re-seeding them from every save response
   * retypes a number with a value the response was assembled before.
   */
  const onScreen = (over: Partial<Allowance> = {}): Allowance | null =>
    current === null
      ? null
      : {
          ...current,
          maxImpressions: countIn(drafts.maxImpressions, current.maxImpressions),
          cooldownDays: countIn(drafts.cooldownDays, current.cooldownDays),
          ...over,
        };

  const commit = (next: Allowance | null) => {
    if (next === null) {
      return;
    }

    void (async () => {
      try {
        setAllowance(ready(await saveSiteAllowance(next)));
        setError(null);
      } catch (cause) {
        setError(messageOf(cause));
      }
    })();
  };

  /**
   * Commit a typed number, or leave everything alone.
   *
   * The commit is on blur or Enter, never on every keystroke — the same rule
   * the retention period follows and for a softer version of its reason.
   * Typing `10` passes through `1`, and a saved 1 is a site-wide cap of one
   * impression taking effect on the next page view of every visitor.
   */
  const commitDraft = (field: 'maxImpressions' | 'cooldownDays') => {
    const next = onScreen();

    if (next !== null && next[field] !== current?.[field]) {
      commit(next);
    }
  };

  return (
    <SettingsDisclosure
      title={__('How often anything shows', 'wconvert')}
      summary={current === null
        ? __('Site-wide display limits', 'wconvert')
        : allowanceSummary(current)}
      attention={allowance.status === 'failed' || error !== null}
    >
      <Description className="px-4 pt-4">
        {__('These limits apply to every Optin, in addition to its own display rules.', 'wconvert')}
      </Description>

      {/*
        **A region that fetches owes a loading state** (ADR 0039), and this one
        showed four real controls greyed out instead. That is not the same
        claim: a disabled switch says *you may not change this*, and what was
        true was *we have not read it yet* — so a merchant met a site-wide
        setting that looked forbidden and then quietly became usable.

        The placeholders sit in the region's own grid, so nothing moves when
        the allowance lands.
      */}
      {allowance.status === 'loading' ? (
        <RegionBody>
          <span role="status" className="sr-only">
            {__('Loading…', 'wconvert')}
          </span>

          <div className="wconvert-allowance" aria-hidden="true">
            <Skeleton className="col-span-full h-[1lh] w-96 max-w-full" />
            <Skeleton className="col-span-full h-[1lh] w-96 max-w-full" />
            <Skeleton className="h-[1lh] w-48 max-w-full" />
            <Skeleton className="h-(--control-height) w-24" />
            <Skeleton className="h-[1lh] w-32 max-w-full" />
            <Skeleton className="h-[1lh] w-48 max-w-full" />
            <Skeleton className="h-(--control-height) w-24" />
            <Skeleton className="h-[1lh] w-32 max-w-full" />
          </div>
        </RegionBody>
      ) : allowance.status === 'failed' ? (
        <RegionErrorState message={allowance.message} />
      ) : (
        <>
          {error !== null && <RegionError message={error} />}

          <RegionBody>
            <div className="wconvert-allowance">
              <label className="wconvert-allowance__switch text-body">
                <input
                  type="checkbox"
                  checked={current?.stopAfterDismiss === true}
                  disabled={current === null}
                  onChange={(event) => commit(onScreen({ stopAfterDismiss: event.target.checked }))}
                />{' '}
                {__('Once they close any Optin, show them nothing else', 'wconvert')}
              </label>

              <label className="wconvert-allowance__switch text-body">
                <input
                  type="checkbox"
                  checked={current?.stopAfterConversion === true}
                  disabled={current === null}
                  onChange={(event) => commit(onScreen({ stopAfterConversion: event.target.checked }))}
                />{' '}
                {__('Once they sign up to anything, show them nothing else', 'wconvert')}
              </label>

              <label htmlFor="wconvert-site-max">
                {__('Show at most this many in total', 'wconvert')}
              </label>
              <Input
                id="wconvert-site-max"
                type="number"
                className="w-24"
                min={1}
                value={drafts.maxImpressions}
                disabled={current === null}
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
              <Input
                id="wconvert-site-cooldown"
                type="number"
                className="w-24"
                min={1}
                value={drafts.cooldownDays}
                disabled={current === null}
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
    </SettingsDisclosure>
  );
}

function allowanceSummary(allowance: Allowance): string {
  const limits = [
    allowance.stopAfterDismiss ? __('Stop after a dismissal', 'wconvert') : null,
    allowance.stopAfterConversion ? __('Stop after a conversion', 'wconvert') : null,
    allowance.maxImpressions === null ? null : sprintf(
      _n('At most %d impression', 'At most %d impressions', allowance.maxImpressions, 'wconvert'),
      allowance.maxImpressions,
    ),
    allowance.cooldownDays === null ? null : sprintf(
      _n('%d day between Optins', '%d days between Optins', allowance.cooldownDays, 'wconvert'),
      allowance.cooldownDays,
    ),
  ].filter(Boolean);

  return limits.length ? limits.join(' · ') : __('No site-wide limits. Each Optin uses its own display rules.', 'wconvert');
}

const draftsOf = (allowance: Allowance) => ({
  maxImpressions: allowance.maxImpressions === null ? '' : String(allowance.maxImpressions),
  cooldownDays: allowance.cooldownDays === null ? '' : String(allowance.cooldownDays),
});

/**
 * A typed number, or what is stored where it is not one yet.
 *
 * An emptied box is *no limit* rather than zero — the same reading
 * `HowOften.tsx` takes and the same one `src/Optin/Frequency.php` takes of a
 * count it cannot use. A draft that is not a usable number is neither saved nor
 * silently corrected: the field keeps what was typed, and the allowance keeps
 * what it had, so a merchant half way through typing `10` who ticks a switch
 * does not have a cap of `1` written for them.
 */
const countIn = (typed: string, stored: number | null): number | null => {
  if (typed === '') {
    return null;
  }

  const count = Number(typed);

  return Number.isInteger(count) && count >= 1 ? count : stored;
};
