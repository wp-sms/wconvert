import { __, sprintf } from '@wordpress/i18n';
import { formatCount, formatRate } from '../lib/format';
import type { GoalReport, OptinReport } from '../stats/api';

/** One campaign's numbers as its row shows them. */
export type RowResult = {
  count: number;
  shown: number;
  rate: number | null;
  label: string;
  capture: boolean;
  /** False for a message: nothing converts, so there is no rate (ADR 0163). */
  counted: boolean;
};

export function rowResultOf(goal: GoalReport, row: OptinReport): RowResult {
  return goal.action === 'none'
    ? { count: row.impressions, shown: row.impressions, rate: null, label: goal.result_label, capture: false, counted: false }
    : { count: row.conversions, shown: row.impressions, rate: row.conversion_rate, label: goal.result_label, capture: goal.action === 'submit', counted: true };
}

/** The line under a row's number: its rate of shown, or that a message has none. */
export function shownLine(result: RowResult): string {
  return result.counted
    /* translators: 1: a conversion rate such as "2.5%", 2: how many times the campaign was shown. */
    ? sprintf(__('%1$s of %2$s shown', 'wconvert'), formatRate(result.rate), formatCount(result.shown))
    : __('Rate not counted', 'wconvert');
}
