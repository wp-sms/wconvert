import { __ } from '@wordpress/i18n';
import { tierName } from '../goals/availability';

/** The same product mark and installed-plan identity in both frame bands. */
export function BrandMark() {
  return <span className="wc-brand-mark" aria-hidden="true">w</span>;
}

export function PlanBadge({ tier }: { tier: string }) {
  return <span className="wc-plan-badge">{tier === 'free' ? __('Free', 'wconvert') : tierName(tier)}</span>;
}
