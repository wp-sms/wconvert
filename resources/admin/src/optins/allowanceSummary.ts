import { __, _n, sprintf } from '@wordpress/i18n';
import { formatCount } from '../lib/format';
import type { SiteAllowance as Allowance } from './api';

/**
 * **One label per limit** (ADR 0131): the Settings form, its review dialog and
 * the builder's "Site-wide limits also apply" note all read these words, so a
 * limit is never "appearances" in one place and "impressions" in another.
 */
export const ALLOWANCE_LABELS = {
  maxImpressions: () => __('Show campaigns at most', 'wconvert'),
  cooldownDays: () => __('Wait between campaigns', 'wconvert'),
  stopAfterDismiss: () => __('Stop showing campaigns after a visitor closes one', 'wconvert'),
  stopAfterConversion: () => __('Stop showing campaigns after a visitor converts', 'wconvert'),
};

/** Each limit the site sets, as one line, in the form's order. */
export function allowanceLines(allowance: Allowance): string[] {
  const lines: (string | null)[] = [
    allowance.maxImpressions === null ? null : sprintf(
      /* translators: %s: a number of times. */
      _n('Show campaigns at most %s time per visitor', 'Show campaigns at most %s times per visitor', allowance.maxImpressions, 'wconvert'),
      formatCount(allowance.maxImpressions),
    ),
    allowance.cooldownDays === null ? null : sprintf(
      /* translators: %s: a number of days. */
      _n('Wait %s day between campaigns', 'Wait %s days between campaigns', allowance.cooldownDays, 'wconvert'),
      formatCount(allowance.cooldownDays),
    ),
    allowance.stopAfterDismiss ? ALLOWANCE_LABELS.stopAfterDismiss() : null,
    allowance.stopAfterConversion ? ALLOWANCE_LABELS.stopAfterConversion() : null,
  ];
  return lines.filter((line): line is string => line !== null);
}

export function allowanceSummary(allowance: Allowance): string {
  const lines = allowanceLines(allowance);
  return lines.length ? lines.join(' · ') : __('No site-wide limits. Each campaign uses its own display rules.', 'wconvert');
}

/** Does the site set any limit at all? The builder mentions the allowance only when it does. */
export function hasSiteLimits(allowance: Allowance): boolean {
  return allowance.stopAfterDismiss || allowance.stopAfterConversion || allowance.maxImpressions !== null || allowance.cooldownDays !== null;
}
