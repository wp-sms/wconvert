import { describe, expect, it } from 'vitest';
import { fieldChips, filterCards, mergeDesigns, mergeSetups, optionCounts, shelfCollections, type GalleryCard, type GalleryFilters } from '../../resources/admin/src/gallery/model';
import type { Collection } from '../../resources/admin/src/discovery/api';
import halloweenSource from '../../resources/collections/halloween-2026.json';
import { onlineCollection } from './support/online-collection';
import type { GoalGallery, OnlineSetup, PlaybookEntry } from '../../resources/admin/src/goals/api';
import type { TemplateFacets, TemplateIndexEntry } from '../../resources/admin/src/templates/api';

const facets = (captures: string[], act: 'submit' | 'click' = captures.length ? 'submit' : 'click'): TemplateFacets =>
  ({ act, captures, shape: 'stack', has_image: false, asks_consent: false });
const local = (id: string, more: Partial<PlaybookEntry> = {}): PlaybookEntry => ({
  id, name: id, goal: 'grow_email_list', template_id: `${id}-design`, display_type: 'popup', availability: 'ready', revision: 'r',
  rules: [], targeting: {}, destination_hint: {}, notes: '', facets: facets(['email']), ...more,
} as PlaybookEntry);
const online = (id: string, more: Partial<OnlineSetup> = {}): OnlineSetup => ({
  id, revision: 1, sha256: 'a'.repeat(64), name: id, goal: 'grow_email_list', tier: 'free', state: 'install', installed_playbook_id: null,
  business_types: [], design: { id: `${id}-design`, name: id, tier: 'free' }, display_type: 'inline', facets: facets(['phone']),
  thumbnail: { '1x': `https://cdn/${id}.webp`, '2x': `https://cdn/${id}@2x.webp` }, tags: [], preview_url: `https://wconvert.io/templates/${id}/`, ...more,
});
const gallery = (setups: PlaybookEntry[], rows: OnlineSetup[] = []): GoalGallery => ({ setups, online: rows, library: { configured: true, consent: 'yes' } });
const free = { proHints: true };
const keys = (cards: GalleryCard[]) => cards.map(card => card.key);
const NONE: GalleryFilters = {};

describe('merging a goal’s setups', () => {
  it('puts recommended setups first and otherwise keeps the server’s order, online after local', () => {
    const cards = mergeSetups(gallery([local('a'), local('b', { recommendation: 'Recommended for stores' }), local('c')], [online('d')]), free);

    expect(keys(cards)).toEqual(['b', 'a', 'c', 'd']);
    expect(cards[0].recommended).toBe('Recommended for stores');
    expect(cards.map(card => card.source)).toEqual(['local', 'local', 'local', 'online']);
  });

  it('draws an online setup from its picture and says it must be installed', () => {
    const [card] = mergeSetups(gallery([], [online('d')]), free);

    expect(card).toMatchObject({ availability: 'install', source: 'online', displayType: 'inline', captures: ['phone'], template_id: 'd-design', sha256: 'a'.repeat(64) });
    expect(card.thumbnail).toEqual({ '1x': 'https://cdn/d.webp', '2x': 'https://cdn/d@2x.webp' });
  });

  it('shows one card for a setup installed at an older revision, offering the newer one', () => {
    const cards = mergeSetups(gallery([local('setup-1-d')], [online('d', { revision: 2, installed_playbook_id: 'setup-1-d' })]), free);

    expect(keys(cards)).toEqual(['setup-1-d']);
    expect(cards[0].newerRevision).toEqual({ id: 'd', revision: 2, sha256: 'a'.repeat(64) });
  });

  it('offers a newer revision only when it can be installed', () => {
    const cards = mergeSetups(gallery([local('setup-1-d')], [online('d', { revision: 2, installed_playbook_id: 'setup-1-d', state: 'update_plugin' })]), free);

    expect(keys(cards)).toEqual(['setup-1-d']);
    expect(cards[0].newerRevision).toBeNull();
  });

  it('keeps a local setup’s own plan', () => {
    expect(mergeSetups(gallery([local('p', { tier: 'pro' })]), free)[0].tier).toBe('pro');
  });

  it('keeps locked cards where they fall, and only where Pro hints are wanted', () => {
    const response = gallery([local('a'), local('paid', { availability: 'locked' }), local('b')], [online('pro-row', { state: 'locked', tier: 'pro' })]);

    expect(keys(mergeSetups(response, free))).toEqual(['a', 'paid', 'b', 'pro-row']);
    expect(keys(mergeSetups(response, { proHints: false }))).toEqual(['a', 'b']);
  });
});

describe('merging the design index', () => {
  it('turns a hosted design into an online card and keeps a local one live', () => {
    const entries = [
      { id: 'card', name: 'Card', display_type: 'popup', tier: 'free', availability: 'ready', facets: facets(['email']), revision: 1, newer_revision: { revision: 2, sha256: 'b'.repeat(64) } },
      { id: 'design-1-supper', name: 'Supper', display_type: 'slide_in', tier: 'pro', availability: 'locked', facets: facets([]), preview_url: 'https://wconvert.io/templates/supper/',
        remote: { id: 'supper', revision: 1, sha256: 'c'.repeat(64), state: 'locked', thumbnail: null, tags: ['industry:food-drink'], family: null, popularity: null, prerequisites: [] } },
    ] as TemplateIndexEntry[];
    const [card, supper] = mergeDesigns(entries, free);

    expect(card).toMatchObject({ key: 'card', source: 'local', availability: 'ready', newerRevision: { id: 'card', revision: 2, sha256: 'b'.repeat(64) } });
    expect(supper).toMatchObject({ key: 'design-1-supper', source: 'online', availability: 'locked', tags: ['industry:food-drink'], previewUrl: 'https://wconvert.io/templates/supper/' });
  });
});

describe('filtering', () => {
  const cards = mergeSetups(gallery([
    local('mail', { business_types: [{ id: 'stores', label: 'Stores' }] }),
    local('text', { facets: facets(['phone']), display_type: 'slide_in' }),
    local('both', { facets: facets(['email', 'phone']) }),
    local('button', { facets: facets([]) }),
  ], [online('pro', { state: 'locked', tier: 'pro', facets: facets(['email']), tags: ['industry:retail'] })]), free);

  it('asks for: each channel, or none', () => {
    expect(keys(filterCards(cards, { asks: 'phone' }))).toEqual(['text', 'both']);
    expect(keys(filterCards(cards, { asks: 'email' }))).toEqual(['mail', 'both', 'pro']);
    expect(keys(filterCards(cards, { asks: 'none' }))).toEqual(['button']);
  });

  it('format, business, plan, saved and search', () => {
    expect(keys(filterCards(cards, { format: 'slide_in' }))).toEqual(['text']);
    expect(keys(filterCards(cards, { business: 'stores' }))).toEqual(['mail']);
    expect(keys(filterCards(cards, { plan: 'pro' }))).toEqual(['pro']);
    expect(keys(filterCards(cards, { plan: 'free' }))).toEqual(['mail', 'text', 'both', 'button']);
    expect(keys(filterCards(cards, { saved: new Set(['registered:both-design']) }))).toEqual(['both']);
    expect(keys(filterCards(cards, { query: 'TEX' }))).toEqual(['text']);
    expect(keys(filterCards(cards, { query: 'stores' }))).toEqual(['mail']);
  });

  it('a collection, and a stage inside it', () => {
    const collection = { members: new Map([['mail', 'before'], ['text', 'during']]) };

    expect(keys(filterCards(cards, { collection }))).toEqual(['mail', 'text']);
    expect(keys(filterCards(cards, { collection, stage: 'during' }))).toEqual(['text']);
  });

  it('the editor’s extras: a tag, a layout and a picture', () => {
    expect(keys(filterCards(cards, { tags: { industry: 'retail' } }))).toEqual(['pro']);
    expect(keys(filterCards(cards, { shape: 'row' }))).toEqual([]);
    expect(keys(filterCards(cards, { hasImage: true }))).toEqual([]);
  });

  it('counts what each option would leave, ignoring the facet’s own choice, and keeps a selected option at zero', () => {
    expect(optionCounts(cards, { asks: 'phone' }, 'asks')).toEqual({ any: 5, email: 3, phone: 2, none: 1 });
    expect(optionCounts(cards, { format: 'slide_in', asks: 'none' }, 'asks')).toEqual({ any: 1, phone: 1, none: 0 });
    expect(optionCounts(cards, NONE, 'format')).toEqual({ all: 5, popup: 3, slide_in: 1, inline: 1 });
    expect(optionCounts(cards, NONE, 'plan')).toEqual({ all: 5, free: 4, pro: 1 });
    const blocked = mergeSetups(gallery([], [online('woo', { state: 'unavailable', tier: 'pro' })]), free);
    expect(keys(filterCards(blocked, { plan: 'pro' }))).toEqual(['woo']);
    expect(optionCounts(cards, { tags: { industry: 'food' } }, 'industry')).toEqual({ '': 5, retail: 1, food: 0 });
  });
});

describe('the field chips', () => {
  it('names what a card asks for, or Button when it only takes a click', () => {
    const [mail, both, button] = mergeSetups(gallery([local('mail'), local('both', { facets: facets(['name', 'email', 'phone']) }), local('button', { facets: facets([]) })]), free);

    expect(fieldChips(mail)).toEqual(['Email']);
    expect(fieldChips(both)).toEqual(['Name', 'Email', 'Phone']);
    expect(fieldChips(button)).toEqual(['Button']);
  });
});

describe('the collections shelf', () => {
  const cards = mergeSetups(gallery([local('a'), local('b')], [online('c')]), free);
  const collection = (id: string, items: string[], more: Partial<Collection> = {}): Collection => ({
    id, revision: 'r', name: id, description: '', business_types: [], priority: 0, cover: 'sale',
    items: items.map(setup_id => ({ setup_id, stage: 'during' as const })), ...more,
  });
  const halloween = { family: 'halloween', start: '2026-10-25', end_exclusive: '2026-11-01', feature_start: '2026-09-01', feature_end_exclusive: '2026-11-01' };

  it('offers the collections with a card here, in priority order, and a seasonal one only in its window', () => {
    const all = [collection('reading', ['a']), collection('sale', ['b', 'c'], { priority: 5 }), collection('elsewhere', ['z']), collection('spooky', ['a'], { event: halloween })];

    expect(shelfCollections(all, cards, '2026-10-20', []).map(shelf => shelf.collection.id)).toEqual(['sale', 'reading', 'spooky']);
    expect(shelfCollections(all, cards, '2026-11-02', []).map(shelf => shelf.collection.id)).toEqual(['sale', 'reading']);
    expect(shelfCollections(all, cards, '2026-10-20', ['sale']).map(shelf => shelf.collection.id)).toEqual(['reading', 'spooky']);
    expect([...shelfCollections(all, cards, '2026-10-20', [])[0].members]).toEqual([['b', 'during'], ['c', 'during']]);
  });

  it('features the bundled Halloween collection through September and October, then retires it', () => {
    const halloween = halloweenSource as Collection;
    const members = mergeSetups(gallery(halloween.items.map(item => local(item.setup_id))), free);

    expect(shelfCollections([halloween], members, '2026-08-31', [])).toEqual([]);
    for (const day of ['2026-09-01', '2026-10-31']) expect(shelfCollections([halloween], members, day, [])[0].members.size).toBe(5);
    expect(shelfCollections([halloween], members, '2026-11-01', [])).toEqual([]);
  });

  it('finds a hosted member as an online card, and as the local card it became once installed', () => {
    const hosted = onlineCollection();
    const before = mergeSetups(gallery([], [online('sale-1'), online('sale-2')]), free);

    expect([...shelfCollections([hosted], before, '2026-10-20', [])[0].members.keys()]).toEqual(['sale-1', 'sale-2']);
    hosted.online![0].playbook_id = 'setup-1-sale-1';
    const after = mergeSetups(gallery([local('setup-1-sale-1')], [online('sale-2')]), free);
    expect([...shelfCollections([hosted], after, '2026-10-20', [])[0].members.keys()]).toEqual(['setup-1-sale-1', 'sale-2']);
  });

  it('draws the library’s copy of a bundled collection as one tile', () => {
    const bundled = collection('sale', ['a']);
    const hosted = { ...collection('catalog-sale', ['a', 'c']), name: 'Sale (library)' };

    for (const order of [[bundled, hosted], [hosted, bundled]]) {
      const shelves = shelfCollections(order, cards, '2026-10-20', []);
      expect(shelves.map(shelf => [shelf.collection.id, [...shelf.members.keys()]])).toEqual([['sale', ['a', 'c']]]);
    }
    expect(shelfCollections([bundled, hosted], cards, '2026-10-20', ['sale'])).toEqual([]);
  });
});
