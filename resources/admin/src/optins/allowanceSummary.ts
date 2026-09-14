import { __, _n, sprintf } from '@wordpress/i18n';
import type { SiteAllowance as Allowance } from './api';

export function allowanceSummary(allowance: Allowance): string {
  const limits = [
    allowance.stopAfterDismiss ? __('Stop after a dismissal', 'wconvert') : null,
    allowance.stopAfterConversion ? __('Stop after a conversion', 'wconvert') : null,
    allowance.maxImpressions === null ? null : sprintf(
      _n('At most %d impression', 'At most %d impressions', allowance.maxImpressions, 'wconvert'),
      allowance.maxImpressions,
    ),
    allowance.cooldownDays === null ? null : sprintf(
      _n('%d day between Campaigns', '%d days between Campaigns', allowance.cooldownDays, 'wconvert'),
      allowance.cooldownDays,
    ),
  ].filter(Boolean);

  return limits.length ? limits.join(' · ') : __('No site-wide limits. Each Campaign uses its own display rules.', 'wconvert');
}
