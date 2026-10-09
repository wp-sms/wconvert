import { __, sprintf } from '@wordpress/i18n';
import type { Loadable } from '../shell/loadable';
import type { GoalEntry } from './api';

/**
 * What an [[Optin]] is for, as one clause — **the sentence two surfaces say
 * and neither owns.**
 *
 * ============================================================================
 * IT LIVED IN `ReadinessDialog` AS `subject()`, AND THEN IT HAD TWO READERS.
 * ============================================================================
 * The review dialog and Campaign details say it (ADR 0087).
 * Two spellings of *"Goal · counts Word"*
 * would be two chances for the same Optin to be described differently on one
 * screen — the same argument that keeps the wording in PHP rather than in a
 * `match` over Goal ids here.
 *
 * **The Goal and the word for its number, as one fact.** A Goal named without
 * the number is half an answer: what a merchant is judged on is the pairing,
 * and *"counts Deliveries"* is the half that says the delivery — not the
 * Conversion before it — is the figure on the card.
 *
 * An id with no registry entry behind it — a Goal whose plugin went away, or
 * a registry that could not be read — reads **"Goal unavailable"**, never the
 * raw id (ADR 0131): a key on screen tells a merchant nothing they can act
 * on, and blanking it would read as an Optin with no Goal at all. **Empty
 * while the registry has not answered**, because a placeholder flashing into
 * a label teaches a merchant that it means *wait* rather than what it says.
 */
export function goalSaid(goal: Loadable<GoalEntry | null>, goalId: string): string {
  const entry = goal.status === 'ready' ? goal.data : null;

  if (entry === null) {
    return goal.status === 'loading' || goalId === '' ? '' : __('Goal unavailable', 'wconvert');
  }

  return sprintf(
    /* translators: 1: a Goal, e.g. “Grow my email list”. 2: what its number is called, e.g. “Conversions”. */
    __('%1$s · counts %2$s', 'wconvert'),
    entry.label,
    entry.headline_label,
  );
}
