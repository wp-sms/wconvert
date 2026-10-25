import { describe, expect, it } from 'vitest';
import { designKey, preferredStage, siteDay } from '../../resources/admin/src/discovery/model';
import type { Collection } from '../../resources/admin/src/discovery/api';
import halloweenSource from '../../resources/collections/halloween-2026.json';

const collection: Collection = { id: 'bf', revision: 'r', name: 'Sale', description: 'Sale ideas', cover: 'sale', priority: 1, business_types: ['stores'], event: { family: 'black-friday', start: '2026-11-27', end_exclusive: '2026-12-01', feature_start: '2026-10-16', feature_end_exclusive: '2026-12-01' }, items: [{ setup_id: 'before', stage: 'before' }, { setup_id: 'bar', stage: 'during' }] };
const at = (...ids: string[]) => ids.map(id => ({ id }));

describe('the stage a collection opens at', () => {
  it('is any for an evergreen planning collection', () => {
    const halloween = halloweenSource as Collection;
    expect(preferredStage(halloween, '2026-10-01', at(...halloween.items.map(item => item.setup_id)))).toBe('any');
  });

  it('selects a nonempty relevant stage for what is shown', () => {
    expect(preferredStage(collection, '2026-11-06', at('bar'))).toBe('during');
    expect(preferredStage(collection, '2026-11-28', at('before'))).toBe('before');
  });

  it('uses custom occasion dates inclusively and falls back only to a reviewed nonempty stage', () => {
    const occasion = { id: 'anniversary', name: 'Our anniversary', start: '2026-10-10', end: '2026-10-12' };
    const guide = { ...collection, items: [...collection.items, { setup_id: 'followup', stage: 'after' as const }] };
    const entries = at('before', 'bar', 'followup');
    expect(preferredStage(guide, '2026-10-09', entries, occasion)).toBe('before');
    expect(preferredStage(guide, '2026-10-12', entries, occasion)).toBe('during');
    expect(preferredStage(guide, '2026-10-13', entries, occasion)).toBe('after');
    expect(preferredStage(guide, '2026-10-13', at('before'), occasion)).toBe('before');
  });
});

it('names a design by its canonical key', () => {
  expect(designKey({ id: 'pack-digest-card', design_key: 'pack:shop:card' })).toBe('pack:shop:card');
  expect(designKey({ id: 'welcome', template_id: 'card' })).toBe('registered:card');
});

it('uses the site calendar across midnight and daylight-saving changes', () => {
  expect(siteDay(Date.parse('2026-09-30T22:00:00Z'), '+03:00', 10800)).toBe('2026-10-01');
  expect(siteDay(Date.parse('2026-03-08T04:59:59Z'), 'America/New_York', -18000)).toBe('2026-03-07');
  expect(siteDay(Date.parse('2026-03-08T05:00:00Z'), 'America/New_York', -18000)).toBe('2026-03-08');
});
