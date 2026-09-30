import type { PlaybookEntry } from '../goals/api';
export const startingPointDisplayType = (entry: PlaybookEntry) => entry.setup?.display_type ?? entry.display_type;
import type { Collection, PickerData } from './api';

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

export const designKey = (entry: { design_key?: string; template_id?: string; id: string }) =>
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
export function preferredStage(collection: Collection, today: string, matches: readonly PlaybookEntry[]) {
  const available = new Set(matches.map(entry => entry.id));
  const preferred = !collection.event || today < collection.event.start ? 'before'
    : today < collection.event.end_exclusive ? 'during' : 'after';
  const stages = [preferred, 'before', 'during', 'after', 'any'] as const;
  return stages.find(stage => collection.items.some(item => item.stage === stage && available.has(item.setup_id))) ?? 'any';
}
export function matchingCollections(data: PickerData, entries: readonly PlaybookEntry[], featured: boolean) {
  const ready = new Set(entries.filter(entry => !entry.availability || entry.availability === 'ready').map(entry => entry.id));
  return data.collections.filter(collection => {
    if (featured && data.preferences.hidden.includes(collection.id)) return false;
    if (collection.event && data.preferences.events.includes(collection.event.family)) return false;
    if (collection.markets.length && !collection.markets.some(market => data.preferences.markets.includes(market))) return false;
    if (collection.event && (data.today >= collection.event.end_exclusive || (featured
      && (data.today < collection.event.feature_start || data.today >= collection.event.feature_end_exclusive)))) return false;
    return collection.items.some(item => ready.has(item.setup_id));
  }).map(collection => {
    const ids = new Set(collection.items.map(item => item.setup_id));
    const setups = entries.filter(entry => ready.has(entry.id) && ids.has(entry.id));
    return { collection, setups, designs: new Set(setups.map(designKey)).size };
  }).sort((a, b) => Number(b.collection.business_types.some(id => data.preferences.businesses.includes(id)))
    - Number(a.collection.business_types.some(id => data.preferences.businesses.includes(id)))
    || b.collection.priority - a.collection.priority || a.collection.id.localeCompare(b.collection.id));
}
