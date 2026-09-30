import { describe, expect, it } from 'vitest';
import { designKey, groupSetups, matchingCollections, preferredStage } from '../../resources/admin/src/discovery/model';
import type { PlaybookEntry } from '../../resources/admin/src/goals/api';
import type { Collection, PickerData } from '../../resources/admin/src/discovery/api';
const setup = (id: string, design = 'registered:card', availability = 'ready', format = 'popup') => ({ id, design_key: design, display_type: format, availability }) as PlaybookEntry;
const collection: Collection = { id: 'bf', revision: 'r', name: 'Sale', description: 'Sale ideas', cover: 'sale', priority: 1, business_types: ['stores'], markets: [], event: { family: 'black-friday', start: '2026-11-27', end_exclusive: '2026-12-01', feature_start: '2026-10-16', feature_end_exclusive: '2026-12-01' }, items: [{ setup_id: 'before', stage: 'before' }, { setup_id: 'bar', stage: 'during' }] };
const data: PickerData = { schema: 1, today: '2026-11-06', timezone: 'Asia/Muscat', collections: [collection], preferences: { schema: 1, revision: 0, saved: [], hidden: [], events: [], businesses: [], markets: [] }, occasions: { schema: 1, revision: 0, items: [] } };
describe('relevant, distinct discovery', () => {
  it('groups only filtered setups and separates formats and namespaces', () => {
    const entries = [setup('a'), setup('b'), setup('c', 'pack:shop:card'), setup('d', 'registered:card', 'ready', 'inline')];
    expect(groupSetups(entries).size).toBe(3); expect(groupSetups(entries.slice(1, 2)).values().next().value?.[0].id).toBe('b');
    expect(designKey({ id: 'pack-digest-card', design_key: 'pack:shop:card' })).toBe('pack:shop:card');
  });
  it('shows exact matching counts and does not feature locked dependencies', () => {
    const matches = matchingCollections(data, [setup('before'), setup('bar', 'registered:card', 'locked')], true);
    expect(matches).toHaveLength(1); expect(matches[0].setups).toHaveLength(1); expect(matches[0].designs).toBe(1);
    const shared = matchingCollections(data, [setup('before'), setup('bar', 'registered:card', 'ready', 'floating_bar')], true);
    expect(shared[0].setups).toHaveLength(2); expect(shared[0].designs).toBe(1);
  });
  it('uses site calendar days, feature windows, market preferences and event opt-outs', () => {
    const entries = [setup('before')];
    expect(matchingCollections({ ...data, today: '2026-10-15' }, entries, true)).toEqual([]);
    expect(matchingCollections({ ...data, today: '2026-10-15' }, entries, false)).toHaveLength(1);
    expect(matchingCollections({ ...data, today: '2026-12-01' }, entries, false)).toEqual([]);
    expect(matchingCollections({ ...data, preferences: { ...data.preferences, events: ['black-friday'] } }, entries, false)).toEqual([]);
    expect(matchingCollections({ ...data, collections: [{ ...collection, markets: ['GB'] }] }, entries, false)).toEqual([]);
    expect(matchingCollections({ ...data, preferences: { ...data.preferences, hidden: ['bf'] } }, entries, true)).toEqual([]);
    expect(matchingCollections({ ...data, preferences: { ...data.preferences, hidden: ['bf'] } }, entries, false)).toHaveLength(1);
  });
  it('selects a nonempty relevant stage for a bar-only filter', () => {
    expect(preferredStage(collection, data.today, [setup('bar')])).toBe('during');
    expect(preferredStage(collection, '2026-11-28', [setup('before')])).toBe('before');
  });
  it('counts 500 setups honestly without claiming 500 different designs', () => {
    const entries = Array.from({ length: 500 }, (_, at) => setup(`setup-${at}`, `registered:card-${at % 120}`));
    expect(groupSetups(entries).size).toBe(120);
  });
});

it('uses the site calendar across midnight and daylight-saving changes', async () => {
  const { siteDay } = await import('../../resources/admin/src/discovery/model');
  expect(siteDay(Date.parse('2026-09-30T22:00:00Z'), '+03:00', 10800)).toBe('2026-10-01');
  expect(siteDay(Date.parse('2026-03-08T04:59:59Z'), 'America/New_York', -18000)).toBe('2026-03-07');
  expect(siteDay(Date.parse('2026-03-08T05:00:00Z'), 'America/New_York', -18000)).toBe('2026-03-08');
});

it('recommends preferred businesses first without removing other matching collections', () => {
  const service = { ...collection, id: 'services', business_types: ['services'], priority: 0 };
  const matches = matchingCollections({ ...data, collections: [collection, service], preferences: { ...data.preferences, businesses: ['services'] } }, [setup('before')], true);
  expect(matches.map(value => value.collection.id)).toEqual(['services', 'bf']);
});
