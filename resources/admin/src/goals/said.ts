import { __ } from '@wordpress/i18n';
import type { Loadable } from '../shell/loadable';
import type { GoalEntry } from './api';

/**
 * What an [[Optin]] is for, as one clause — **the sentence the review dialog
 * and the editor's Details say in their headers and neither owns.**
 *
 * The Goal alone, since ADR 0183. It used to carry the word for its number too
 * (*"Goal · counts Word"*), which the same dialog then said again a few lines
 * down, beside the preview: the number's name is said there, once.
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

  return entry.label;
}
