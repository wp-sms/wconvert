import { __ } from '@wordpress/i18n';
import { formatDay, formatRange } from '../lib/format';
import type { GoalReport, Numbers, OptinReport, DashboardPayload } from './api';

/** Every stored arm is counted once; family totals are only a presentation. */
export function families(
  card: GoalReport,
): Array<{ root: OptinReport; arms: OptinReport[]; numbers: Numbers }> {
  const ids = new Set(card.optins.map((row) => row.id));
  const children = new Map<string, OptinReport[]>();
  for (const row of card.optins) {
    if (row.parent_id === null) continue;
    const siblings = children.get(row.parent_id) ?? [];
    siblings.push(row);
    children.set(row.parent_id, siblings);
  }
  return card.optins
    .filter((row) => row.parent_id === null || !ids.has(row.parent_id))
    .map((root) => {
      // Successive child winners leave earlier retired arms nested under
      // former winners. Traverse the whole family, not only its current arms.
      const arms = [root];
      for (let index = 0; index < arms.length; index++) {
        arms.push(...(children.get(arms[index].id) ?? []));
      }
      return { root, arms, numbers: addNumbers(arms) };
    });
}

export function addNumbers(rows: Numbers[]): Numbers {
  const total = (
    key: 'headline' | 'conversions' | 'impressions' | 'dismissals',
  ) => rows.reduce((sum, row) => sum + row[key], 0);
  const series = (
    key: 'by_day' | 'conversion_by_day' | 'impression_by_day',
  ) => {
    const result: Record<string, number> = {};
    for (const row of rows)
      for (const [day, value] of Object.entries(row[key]))
        result[day] = (result[day] ?? 0) + value;
    return result;
  };
  const impressions = total('impressions'),
    conversions = total('conversions');
  return {
    headline: total('headline'),
    conversions,
    items_added: rows.reduce((sum, row) => sum + (row.items_added ?? 0), 0),
    impressions,
    dismissals: total('dismissals'),
    conversion_rate: impressions ? conversions / impressions : null,
    deliveries: rows.some((row) => row.deliveries !== null)
      ? rows.reduce((sum, row) => sum + (row.deliveries ?? 0), 0)
      : null,
    by_day: series('by_day'),
    conversion_by_day: series('conversion_by_day'),
    impression_by_day: series('impression_by_day'),
  };
}

/**
 * **One sentence for one fact, everywhere it is said** (ADR 0132): complete-day
 * reports leave today out, and four screens had worded that three ways. The
 * second line is the way to see it, now that Analytics has a live Today.
 */
export const todayAppearsTomorrow = () => __('Today’s activity appears tomorrow.', 'wconvert');
export const chooseToday = () => __('Choose Today to see it so far.', 'wconvert');

/** Dates are calendar labels from PHP, never shifted to the browser's zone. */
export const dateLabel = formatDay;
export const rangeLabel = formatRange;

/** Quoting alone does not prevent spreadsheet formulas in merchant-supplied names. */
export function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function reportCSV(
  payload: DashboardPayload,
  cards: GoalReport[],
  optinId?: string,
): string {
  const rows: (string | number)[][] = [
    [
      'Campaign',
      'ID',
      'Parent ID',
      'Goal',
      'Status',
      'Metric',
      'Results',
      'Shown',
      'Rate',
      'Emails accepted for sending',
      'From',
      'To',
      'Previous results',
      'Previous shown',
      'Previous rate',
      'Previous emails accepted for sending',
      'Previous from',
      'Previous to',
      'Items added to basket',
      'Previous items added to basket',
    ],
  ];
  for (const card of cards)
    for (const optin of card.optins) {
      if (optinId && optin.id !== optinId) continue;
      const prior = payload.previous?.goals
        .find((g) => g.goal === card.goal)
        ?.optins.find((o) => o.id === optin.id);
      rows.push([
        optin.name,
        optin.id,
        optin.parent_id ?? '',
        card.label,
        optin.status,
        card.result_label,
        optin.conversions,
        optin.impressions,
        optin.conversion_rate === null ? '' : String(optin.conversion_rate),
        optin.deliveries ?? '',
        payload.from,
        payload.to,
        prior?.conversions ?? '',
        prior?.impressions ?? '',
        prior?.conversion_rate ?? '',
        prior?.deliveries ?? '',
        payload.previous?.from ?? '',
        payload.previous?.to ?? '',
        card.action === 'add_to_cart' ? optin.items_added ?? 0 : '',
        card.action === 'add_to_cart' ? prior?.items_added ?? '' : '',
      ]);
    }
  return '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}
