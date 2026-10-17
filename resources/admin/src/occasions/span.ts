import { __ } from '@wordpress/i18n';
import { formatShortRange } from '../lib/format';
import { shownDays } from '../lib/occasion';
import { readable } from '../lib/wallTime';
import type { OptinSummary } from '../optins/api';

/** When a campaign shows: its days where it starts and ends at midnight, its times otherwise. */
export function spanOf(row: Pick<OptinSummary, 'starts_at' | 'ends_at'>): string {
  const days = shownDays(row.starts_at, row.ends_at);
  if (days) return formatShortRange(days.from, days.to);
  if (!row.starts_at && !row.ends_at) return __('No dates set', 'wconvert');
  return [readable(row.starts_at ?? undefined) ?? '…', readable(row.ends_at ?? undefined) ?? '…'].join(' – ');
}
