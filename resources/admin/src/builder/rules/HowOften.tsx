import { __ } from '@wordpress/i18n';
import { Description } from '../../shell/Description';
import type { Frequency } from '../api';

/**
 * *How often* it may show — the allowance, and the overlay priority.
 *
 * ============================================================================
 * THE ENGINE HAS HONOURED ALL FOUR FIELDS SINCE #3. NOTHING HAS EVER WRITTEN
 * THEM.
 * ============================================================================
 * `resources/loader/src/frequency.ts` reads `maxImpressions`, `cooldownDays`,
 * `stopAfterDismiss` and `stopAfterConversion`, and `decide.ts` sorts overlays
 * by `priority` — and no surface in this admin has ever produced either. Both
 * reached the browser as unvalidated passthrough out of a config blob, which
 * means every merchant Optin shipped uncapped and unprioritised. This section
 * is the author.
 *
 * ============================================================================
 * `true` IS NEVER WRITTEN, AND THAT IS NOT AN OPTIMISATION.
 * ============================================================================
 * The two switches default ON — `frequency.ts` tests `!== false`, because
 * closing a popup and completing one are the two strongest "stop showing me
 * this" a visitor has (ADR 0017). So an absent key and a stored `true` are the
 * same answer to the engine, and only one of them costs bytes on every page
 * view of every matching page against a 2KB budget. Ticking a box therefore
 * DELETES a key; the value object in `src/Optin/Frequency.php` drops it again
 * on the way in, so a client that wrote one anyway changes nothing.
 *
 * ============================================================================
 * PRIORITY IS DRAWN ONLY WHERE IT DECIDES SOMETHING.
 * ============================================================================
 * `arbitrate()` sorts OVERLAYS and leaves `inline` Optins alone — an inline
 * design renders where it was embedded and never competes for the screen
 * (CONTEXT.md, Display Type). On an inline Optin the control would be real,
 * stored, and inert, which is the shape wp.org Guideline 9 is about one layer
 * up: a control the merchant can use and that cannot do anything.
 */
export interface HowOftenProps {
  readonly frequency: Frequency;
  readonly priority: number;
  /** Whether this Optin competes for the screen at all. */
  readonly overlay: boolean;
  readonly onFrequency: (frequency: Frequency) => void;
  readonly onPriority: (priority: number) => void;
}

export function HowOften({ frequency, priority, overlay, onFrequency, onPriority }: HowOftenProps) {
  /**
   * Set a switch, writing only the value that travels.
   *
   * Ticked is the default, so it is written by DELETING the key rather than by
   * storing `true`.
   */
  const setSwitch = (field: 'stopAfterDismiss' | 'stopAfterConversion', on: boolean) => {
    const next = { ...frequency };

    if (on) {
      delete next[field];
    } else {
      next[field] = false;
    }

    onFrequency(next);
  };

  /** Set a count, or unset it — an emptied box is "no limit", not zero. */
  const setCount = (field: 'maxImpressions' | 'cooldownDays', value: string) => {
    const next = { ...frequency };
    const count = Number(value);

    if (value === '' || !Number.isFinite(count) || count < 1) {
      delete next[field];
    } else {
      next[field] = Math.floor(count);
    }

    onFrequency(next);
  };

  return (
    <>
      <Description>{__('Left alone, it stops once the visitor closes it or signs up.', 'wconvert')}</Description>

      <p>
        <label>
          <input
            type="checkbox"
            checked={frequency.stopAfterDismiss !== false}
            onChange={(event) => setSwitch('stopAfterDismiss', event.target.checked)}
          />{' '}
          {__('Stop showing it once they close it', 'wconvert')}
        </label>
      </p>

      <p>
        <label>
          <input
            type="checkbox"
            checked={frequency.stopAfterConversion !== false}
            onChange={(event) => setSwitch('stopAfterConversion', event.target.checked)}
          />{' '}
          {__('Stop showing it once they sign up', 'wconvert')}
        </label>
      </p>

      <p>
        <label htmlFor="wconvert-frequency-max">{__('Show it at most this many times', 'wconvert')}</label>{' '}
        <input
          id="wconvert-frequency-max"
          type="number"
          className="small-text"
          min={1}
          value={frequency.maxImpressions ?? ''}
          onChange={(event) => setCount('maxImpressions', event.target.value)}
        />{' '}
        <Description as="span">{__('Empty means no limit.', 'wconvert')}</Description>
      </p>

      <p>
        <label htmlFor="wconvert-frequency-cooldown">{__('Days to wait between showings', 'wconvert')}</label>{' '}
        <input
          id="wconvert-frequency-cooldown"
          type="number"
          className="small-text"
          min={1}
          value={frequency.cooldownDays ?? ''}
          onChange={(event) => setCount('cooldownDays', event.target.value)}
        />{' '}
        <Description as="span">{__('Empty means no wait.', 'wconvert')}</Description>
      </p>

      {/*
        **Only for an Optin that competes.** `arbitrate()` sorts overlays and
        never touches an inline one, so on an inline design this control would
        decide nothing at all — and the summary above says nothing about it
        either, for the same reason.
      */}
      {overlay && (
        <p>
          <label htmlFor="wconvert-priority">{__('Priority against other popups', 'wconvert')}</label>{' '}
          <input
            id="wconvert-priority"
            type="number"
            className="small-text"
            value={priority === 0 ? '' : priority}
            onChange={(event) => {
              const next = Number(event.target.value);

              // Empty and zero are the same rule: `arbitrate()` reads
              // `priority ?? 0`, and the save route drops a stored 0 for
              // exactly that reason.
              onPriority(event.target.value === '' || !Number.isFinite(next) ? 0 : Math.trunc(next));
            }}
          />{' '}
          <Description as="span">
            {__('Only one popup shows per page view. The highest number wins.', 'wconvert')}
          </Description>
        </p>
      )}
    </>
  );
}
