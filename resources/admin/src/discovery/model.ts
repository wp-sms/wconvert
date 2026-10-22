import type { PlaybookEntry } from '../goals/api';
export const startingPointDisplayType = (entry: PlaybookEntry) => entry.setup?.display_type ?? entry.display_type;
import type { Collection, Occasion, PickerData } from './api';

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
export const groupKey = (entry: PlaybookEntry) => `${designKey(entry)}:${startingPointDisplayType(entry)}`;
export function groupSetups(entries: readonly PlaybookEntry[]): Map<string, PlaybookEntry[]> {
  const groups = new Map<string, PlaybookEntry[]>();
  for (const entry of entries) {
    const key = groupKey(entry); const group = groups.get(key) ?? [];
    group.push(entry); groups.set(key, group);
  }
  return groups;
}
export function preferredStage(collection: Collection, today: string, matches: readonly PlaybookEntry[], occasion?: Occasion) {
  const available = new Set(matches.map(entry => entry.id));
  const preferred = occasion ? (today < occasion.start ? 'before' : today <= occasion.end ? 'during' : 'after')
    : !collection.event || today < collection.event.start ? 'before'
    : today < collection.event.end_exclusive ? 'during' : 'after';
  const stages = [preferred, 'before', 'during', 'after', 'any'] as const;
  return stages.find(stage => collection.items.some(item => item.stage === stage && available.has(item.setup_id))) ?? 'any';
}
export function matchingCollections(data: PickerData, entries: readonly PlaybookEntry[], featured: boolean, showProDesigns = true) {
  const ready = new Set(entries.filter(entry => !entry.availability || entry.availability === 'ready').map(entry => entry.id));
  return data.collections.map(collection => {
    // The server resolves the agency opt-out and install_plugins capability.
    // Keep usable copies; only paid discovery cards are hints (ADR 0156 §9).
    if (showProDesigns || !collection.online) return collection;
    const online = collection.online.filter(member => member.setup.tier === 'free' || member.setup.state === 'ready');
    const ids = new Set(online.map(member => member.setup.id));
    return { ...collection, online, items: collection.items.filter(item => ids.has(item.setup_id)) };
  }).filter(collection => {
    if (featured && data.preferences.hidden.includes(collection.id)) return false;
    if (collection.event && data.preferences.events.includes(collection.event.family)) return false;
    if (collection.markets.length && !collection.markets.some(market => data.preferences.markets.includes(market))) return false;
    if (collection.event && (data.today >= collection.event.end_exclusive || (featured
      && (data.today < collection.event.feature_start || data.today >= collection.event.feature_end_exclusive)))) return false;
    return collection.online ? collection.online.length > 0 : collection.items.some(item => ready.has(item.setup_id));
  }).map(collection => {
    const ids = new Set(collection.items.map(item => item.setup_id));
    const setups = entries.filter(entry => ready.has(entry.id) && ids.has(entry.id));
    return collection.online
      ? { collection, setups: collection.online.map(member => ({ id: member.setup.id })), designs: new Set(collection.online.map(member => member.design.id)).size }
      : { collection, setups, designs: new Set(setups.map(designKey)).size };
  }).sort((a, b) => Number(b.collection.business_types.some(id => data.preferences.businesses.includes(id)))
    - Number(a.collection.business_types.some(id => data.preferences.businesses.includes(id)))
    || b.collection.priority - a.collection.priority || a.collection.id.localeCompare(b.collection.id));
}
