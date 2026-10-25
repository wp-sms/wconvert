import type { Collection, Occasion } from './api';

/** Site calendar, including IANA daylight-saving rules and WP fixed offsets. */
export function siteDay(epoch: number, timezone: string, offset: number): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(epoch);
    const part = (key: string) => parts.find(value => value.type === key)?.value ?? '';
    return `${part('year')}-${part('month')}-${part('day')}`;
  } catch {
    return new Date(epoch + offset * 1000).toISOString().slice(0, 10);
  }
}

/** The last day of an event stored with an exclusive end, as `YYYY-MM-DD`. */
export function lastDay(endExclusive: string): string {
  const day = new Date(`${endExclusive}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return [day.getUTCFullYear(), String(day.getUTCMonth() + 1).padStart(2, '0'), String(day.getUTCDate()).padStart(2, '0')].join('-');
}

/** Whole days from one `YYYY-MM-DD` to another; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

/**
 * The site's time zone as words — "Central European Time", not
 * `Europe/Berlin`. A WordPress fixed offset (`+03:30`) reads as "GMT+03:30".
 * Something Intl cannot name comes back empty rather than raw.
 */
export function zoneName(timezone: string, locale?: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { timeZone: timezone || 'UTC', timeZoneName: 'longGeneric' })
      .formatToParts(Date.now()).find(part => part.type === 'timeZoneName')?.value ?? '';
  } catch {
    return '';
  }
}

export const designKey =(entry: { design_key?: string; template_id?: string; id: string }) =>
  entry.design_key ?? `registered:${entry.template_id ?? entry.id}`;
export function preferredStage(collection: Collection, today: string, matches: readonly { id: string }[], occasion?: Occasion) {
  const available = new Set(matches.map(entry => entry.id));
  const preferred = occasion ? (today < occasion.start ? 'before' : today <= occasion.end ? 'during' : 'after')
    : !collection.event || today < collection.event.start ? 'before'
    : today < collection.event.end_exclusive ? 'during' : 'after';
  const stages = [preferred, 'before', 'during', 'after', 'any'] as const;
  return stages.find(stage => collection.items.some(item => item.stage === stage && available.has(item.setup_id))) ?? 'any';
}
