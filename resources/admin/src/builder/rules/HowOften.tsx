import { __ } from '@wordpress/i18n';
import { Description } from '../../shell/Description';
import type { Frequency, Schedule } from '../api';

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
 * A SALE HAS AN END DATE, AND THE MERCHANT TYPES A WALL TIME.
 * ============================================================================
 * Free ships the *Promote a sale or offer* Goal, and without a schedule
 * announcing one means remembering to unpublish the Optin by hand. Forgetting
 * is precisely the *"it keeps popping up"* complaint the WordPress support
 * corpus records in merchants' own words, which is why this is free.
 *
 * **The control writes what was typed and nothing more.** An
 * `<input type="datetime-local">` has no timezone in it, deliberately: the
 * merchant is authoring *nine in the morning on the site*, and the browser
 * doing that arithmetic would do it against the ADMIN's zone, which on a site
 * with two editors in two countries is two different moments for one campaign.
 * Resolving it to an instant is `src/Optin/Schedule.php`'s, once, against
 * `wp_timezone()`, on every rebuild of the published set — so correcting the
 * site's timezone later corrects every schedule with it.
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
  readonly schedule: Schedule;
  readonly priority: number;
  /** Whether this Optin competes for the screen at all. */
  readonly overlay: boolean;
  readonly onFrequency: (frequency: Frequency) => void;
  readonly onSchedule: (schedule: Schedule) => void;
  readonly onPriority: (priority: number) => void;
}

export function HowOften({
  frequency,
  schedule,
  priority,
  overlay,
  onFrequency,
  onSchedule,
  onPriority,
}: HowOftenProps) {
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

  /**
   * Set one boundary, or unset it.
   *
   * An emptied box is *no boundary*, not a boundary at the epoch — the same
   * reading {@link setCount} takes of an emptied number, and the same one
   * `src/Optin/Schedule.php` takes of a value that is not a moment.
   *
   * The control's value carries a `T` and may carry seconds; what is stored is
   * `Y-m-d H:i`, because the value object canonicalises to that on the way in
   * and two spellings of one wall time is two parses.
   */
  const setBoundary = (field: 'starts_at' | 'ends_at', value: string) => {
    const next = { ...schedule };

    if (value === '') {
      delete next[field];
    } else {
      next[field] = value.replace('T', ' ').slice(0, 16);
    }

    onSchedule(next);
  };

  return (
    <>
      <Description>{__('Left alone, it stops once the visitor closes it or signs up.', 'wconvert')}</Description>

      {/*
        ====================================================================
        THREE COLUMNS: THE LABELS, THE FIELDS, AND THE HINTS.
        ====================================================================
        Each setting was `<label> <input> <hint>` in its own paragraph, so
        every field started wherever its own label ended and the longest hint
        wrapped back to the far-left margin — landing a second line of
        explanation under the label of the setting above it. A grid puts each
        in one place and lets a hint wrap inside its own column.
      */}
      <div className="wconvert-allowance">
        <label className="wconvert-allowance__switch text-body">
          <input
            type="checkbox"
            checked={frequency.stopAfterDismiss !== false}
            onChange={(event) => setSwitch('stopAfterDismiss', event.target.checked)}
          />{' '}
          {__('Stop showing it once they close it', 'wconvert')}
        </label>

        <label className="wconvert-allowance__switch text-body">
          <input
            type="checkbox"
            checked={frequency.stopAfterConversion !== false}
            onChange={(event) => setSwitch('stopAfterConversion', event.target.checked)}
          />{' '}
          {__('Stop showing it once they sign up', 'wconvert')}
        </label>

        <label htmlFor="wconvert-frequency-max">{__('Show it at most this many times', 'wconvert')}</label>
        <input
          id="wconvert-frequency-max"
          type="number"
          className="small-text"
          min={1}
          value={frequency.maxImpressions ?? ''}
          onChange={(event) => setCount('maxImpressions', event.target.value)}
        />
        <Description as="span">{__('Empty means no limit.', 'wconvert')}</Description>

        <label htmlFor="wconvert-frequency-cooldown">{__('Days to wait between showings', 'wconvert')}</label>
        <input
          id="wconvert-frequency-cooldown"
          type="number"
          className="small-text"
          min={1}
          value={frequency.cooldownDays ?? ''}
          onChange={(event) => setCount('cooldownDays', event.target.value)}
        />
        <Description as="span">{__('Empty means no wait.', 'wconvert')}</Description>

        {/*
          ====================================================================
          WHEN IT RUNS — TWO BOXES, NEITHER REQUIRING THE OTHER.
          ====================================================================
          *"From Friday, forever"* and *"from now until Friday"* are both
          things merchants mean, so a start without an end and an end without a
          start are both valid. What is refused — at
          `src/Optin/Schedule.php`, not here — is an end at or before its
          start, because that is a window no instant is inside.

          The times are the SITE's, and the hint says so: an
          `<input type="datetime-local">` shows the visitor's own locale
          formatting, and an editor in another country would otherwise
          reasonably read it as theirs.
        */}
        <label htmlFor="wconvert-starts-at">{__('Start showing it on', 'wconvert')}</label>
        <input
          id="wconvert-starts-at"
          type="datetime-local"
          value={(schedule.starts_at ?? '').replace(' ', 'T')}
          onChange={(event) => setBoundary('starts_at', event.target.value)}
        />
        <Description as="span">{__('Empty means it starts as soon as it is published.', 'wconvert')}</Description>

        <label htmlFor="wconvert-ends-at">{__('Stop showing it on', 'wconvert')}</label>
        <input
          id="wconvert-ends-at"
          type="datetime-local"
          value={(schedule.ends_at ?? '').replace(' ', 'T')}
          onChange={(event) => setBoundary('ends_at', event.target.value)}
        />
        <Description as="span">
          {__('Empty means it runs until you unpublish it. Both are your site’s local time.', 'wconvert')}
        </Description>

      {/*
        **Only for an Optin that competes.** `arbitrate()` sorts overlays and
        never touches an inline one, so on an inline design this control would
        decide nothing at all — and the summary above says nothing about it
        either, for the same reason.
      */}
        {overlay && (
          <>
            <label htmlFor="wconvert-priority">{__('Priority against other popups', 'wconvert')}</label>
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
            />
            <Description as="span">
              {__('Only one popup shows per page view. The highest number wins.', 'wconvert')}
            </Description>
          </>
        )}
      </div>
    </>
  );
}
