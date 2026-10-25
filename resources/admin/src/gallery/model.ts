import { __ } from '@wordpress/i18n';
import type { GoalGallery, OnlineSetup, PlaybookEntry } from '../goals/api';
import type { TemplateFacets, TemplateIndexEntry } from '../templates/api';
import type { Collection } from '../discovery/api';
import { designKey } from '../discovery/model';

/**
 * One card in the one template gallery (ADR 0171), whatever it came from: a
 * setup or a design on this site, or one the hosted library would add.
 */
export interface GalleryCard {
  /** A setup's or a design's id: what Save, Use and Inspect name. */
  key: string;
  name: string;
  /** Everything search reads: the name, the design's name and the setup's note. */
  words: string;
  displayType: string;
  facets: TemplateFacets | null;
  captures: string[];
  act: TemplateFacets['act'];
  tier: string;
  availability: 'ready' | 'install' | 'update_plugin' | 'locked' | 'unavailable';
  /** The editorial recommendation, said on the card; null when there is none. */
  recommended: string | null;
  /** A newer revision the library has of this card, applied through the usual flow. */
  newerRevision: { id: string; revision: number; sha256: string } | null;
  source: 'local' | 'online';
  /** The catalogue's picture of a design this site does not have. */
  thumbnail: { '1x': string; '2x': string } | null;
  /** The design: a local template id, or the hosted design's id. */
  template_id: string;
  /** The design's own name where it differs from the template's (an online setup's). */
  designName: string | null;
  /** What Save stores: the design, so a star means the same thing in creation and in the editor. */
  designKey: string;
  business_types: { id: string; label: string }[];
  tags: string[];
  /** The digest an install must match; null for what is already here. */
  sha256: string | null;
  /** Where a locked card's one link goes. */
  previewUrl: string | null;
}

export interface MergeContext {
  /** `ProHints::shown()`: whether a Free site wants Pro designs pointed out. Pro is one plan (ADR 0146), so nothing is locked there. */
  readonly proHints: boolean;
}

function fromFacets(facets: TemplateFacets | null | undefined): Pick<GalleryCard, 'facets' | 'captures' | 'act'> {
  return { facets: facets ?? null, captures: facets?.captures ?? [], act: facets?.act ?? null };
}

function localSetup(entry: PlaybookEntry): GalleryCard {
  return {
    key: entry.id, name: entry.name, words: [entry.name, entry.notes, ...(entry.business_types ?? []).map(type => type.label)].join(' ').toLowerCase(),
    displayType: entry.display_type, ...fromFacets(entry.facets), tier: entry.tier ?? 'free',
    availability: entry.availability ?? 'ready', recommended: entry.recommendation ?? null, newerRevision: null, source: 'local',
    thumbnail: null, template_id: entry.template_id, designName: null, designKey: designKey(entry), business_types: entry.business_types ?? [], tags: [], sha256: null, previewUrl: null,
  };
}

function onlineSetup(row: OnlineSetup): GalleryCard {
  return {
    key: row.id, name: row.name, words: [row.name, row.design.name, ...row.business_types.map(type => type.label)].join(' ').toLowerCase(),
    displayType: row.display_type, ...fromFacets(row.facets), tier: row.tier,
    availability: row.state, recommended: null, newerRevision: null, source: 'online', thumbnail: row.thumbnail,
    template_id: row.design.id, designName: row.design.name, designKey: `registered:${row.design.id}`, business_types: row.business_types, tags: row.tags, sha256: row.sha256, previewUrl: row.preview_url,
  };
}

/**
 * Step 2's cards: this site's setups, then the library's, recommended first
 * and otherwise in the server's order. A locked card stays where it falls —
 * nothing sorts the usable ones first. A setup an earlier revision already
 * installed is one card, offering the newer one.
 */
export function mergeSetups(gallery: GoalGallery, context: MergeContext): GalleryCard[] {
  // Only an installable newer revision is offered as one (as the design index does).
  const replaced = new Map(gallery.online.filter(row => row.installed_playbook_id !== null && row.state === 'install').map(row => [row.installed_playbook_id, row]));
  const local = gallery.setups.map(entry => {
    const card = localSetup(entry);
    const newer = replaced.get(entry.id);

    return newer === undefined ? card : { ...card, newerRevision: { id: newer.id, revision: newer.revision, sha256: newer.sha256 } };
  });
  const installed = new Set(gallery.setups.map(entry => entry.id));
  const online = gallery.online.filter(row => row.installed_playbook_id === null || !installed.has(row.installed_playbook_id)).map(onlineSetup);
  const cards = [...local, ...online].filter(card => card.availability !== 'locked' || context.proHints);

  return [...cards.filter(card => card.recommended !== null), ...cards.filter(card => card.recommended === null)];
}

/** The editor's cards: one per design, in the index's order. */
export function mergeDesigns(entries: readonly TemplateIndexEntry[], context: MergeContext): GalleryCard[] {
  return entries.map((entry): GalleryCard => ({
    key: entry.id, name: entry.name, words: [entry.name, ...(entry.aliases ?? [])].join(' ').toLowerCase(),
    displayType: entry.display_type, ...fromFacets(entry.facets), tier: entry.tier,
    availability: entry.remote?.state ?? entry.availability, recommended: null,
    newerRevision: entry.newer_revision ? { id: entry.id, ...entry.newer_revision } : null,
    source: entry.remote ? 'online' : 'local', thumbnail: entry.remote?.thumbnail ?? null,
    template_id: entry.id, designName: null, designKey: designKey(entry), business_types: [], tags: entry.tags ?? entry.remote?.tags ?? [],
    sha256: entry.remote?.sha256 ?? null, previewUrl: entry.preview_url ?? null,
  })).filter(card => card.availability !== 'locked' || context.proHints);
}

export interface GalleryFilters {
  readonly query?: string;
  /** A format, or `all`. */
  readonly format?: string;
  readonly asks?: 'any' | 'email' | 'phone' | 'none';
  /** A business id, or `any`. */
  readonly business?: string;
  /** `pro` is the locked cards. */
  readonly plan?: 'all' | 'free' | 'pro';
  /** The saved design keys, when only those cards are wanted. */
  readonly saved?: ReadonlySet<string>;
  /** The active collection's members, each with its stage. */
  readonly collection?: { readonly members: ReadonlyMap<string, string> } | null;
  readonly stage?: string;
  /** The editor's taxonomy extras: `{ industry: 'retail' }` matches the tag `industry:retail`. */
  readonly tags?: Readonly<Record<string, string>>;
  readonly shape?: string;
  readonly hasImage?: boolean;
}

export type GalleryFacet = 'format' | 'asks' | 'business' | 'plan' | 'stage' | 'shape' | 'industry' | 'occasion' | 'style';

/** Each facet's filter key and its "anything" value: the one table the counts read. */
const FACETS: Record<GalleryFacet, { readonly any: string; readonly selected: (filters: GalleryFilters) => string | undefined }> = {
  format: { any: 'all', selected: filters => filters.format },
  asks: { any: 'any', selected: filters => filters.asks },
  business: { any: 'any', selected: filters => filters.business },
  plan: { any: 'all', selected: filters => filters.plan },
  stage: { any: 'any', selected: filters => filters.stage },
  shape: { any: '', selected: filters => filters.shape },
  industry: { any: '', selected: filters => filters.tags?.industry },
  occasion: { any: '', selected: filters => filters.tags?.occasion },
  style: { any: '', selected: filters => filters.tags?.style },
};

/** A Pro card: locked, or blocked by a missing plugin while its plan is paid. */
const isPro = (card: GalleryCard): boolean => card.availability === 'locked' || (card.availability === 'unavailable' && card.tier !== 'free');

function passes(card: GalleryCard, filters: GalleryFilters, skip?: GalleryFacet): boolean {
  const { query, format, asks, business, plan, saved, collection, stage, tags, shape, hasImage } = filters;
  const words = query?.trim().toLowerCase();

  if (words && !card.words.includes(words)) return false;
  if (skip !== 'format' && format && format !== 'all' && card.displayType !== format) return false;
  if (skip !== 'asks' && asks && asks !== 'any' && !(asks === 'none' ? card.captures.length === 0 : card.captures.includes(asks))) return false;
  if (skip !== 'business' && business && business !== 'any' && !card.business_types.some(type => type.id === business)) return false;
  if (skip !== 'plan' && plan && plan !== 'all' && (plan === 'pro') !== isPro(card)) return false;
  if (saved && !saved.has(card.designKey)) return false;
  if (collection) {
    const at = collection.members.get(card.key);

    if (at === undefined) return false;
    if (skip !== 'stage' && stage && stage !== 'any' && at !== stage) return false;
  }
  for (const [kind, value] of Object.entries(tags ?? {})) {
    if (value && skip !== kind && !card.tags.includes(`${kind}:${value}`)) return false;
  }
  if (skip !== 'shape' && shape && card.facets?.shape !== shape) return false;
  if (hasImage && card.facets?.has_image !== true) return false;

  return true;
}

export function filterCards(cards: readonly GalleryCard[], filters: GalleryFilters): GalleryCard[] {
  return cards.filter(card => passes(card, filters));
}

const tagged = (kind: string) => (card: GalleryCard) => card.tags.filter(tag => tag.startsWith(`${kind}:`)).map(tag => tag.slice(kind.length + 1));

const valuesOf: Record<GalleryFacet, (card: GalleryCard, filters: GalleryFilters) => string[]> = {
  format: card => [card.displayType],
  asks: card => card.captures.length === 0 ? ['none'] : card.captures.filter(field => field === 'email' || field === 'phone'),
  business: card => card.business_types.map(type => type.id),
  plan: card => [isPro(card) ? 'pro' : 'free'],
  stage: (card, filters) => {
    const at = filters.collection?.members.get(card.key);

    return at === undefined ? [] : [at];
  },
  shape: card => card.facets?.shape ? [card.facets.shape] : [],
  industry: tagged('industry'),
  occasion: tagged('occasion'),
  style: tagged('style'),
};

/**
 * How many cards each option of one facet would leave, given every other
 * filter. An option that would leave nothing is not offered (GUIDELINES §20)
 * — unless it is the one selected, which stays at zero so it can be undone.
 */
export function optionCounts(cards: readonly GalleryCard[], filters: GalleryFilters, facet: GalleryFacet): Record<string, number> {
  const pool = cards.filter(card => passes(card, filters, facet));
  const counts: Record<string, number> = { [FACETS[facet].any]: pool.length };

  for (const card of pool) {
    for (const value of valuesOf[facet](card, filters)) counts[value] = (counts[value] ?? 0) + 1;
  }

  const selected = FACETS[facet].selected(filters);

  if (selected && !Object.hasOwn(counts, selected)) counts[selected] = 0;

  return counts;
}

/** What a card asks a visitor for, in the merchant's words — or Button for a design that only takes a click. */
export function fieldChips(card: GalleryCard): string[] {
  const words: Record<string, string> = { email: __('Email', 'wconvert'), phone: __('Phone', 'wconvert'), name: __('Name', 'wconvert') };
  const chips = card.captures.flatMap(field => words[field] ?? []);

  return chips.length === 0 && card.act === 'click' ? [__('Button', 'wconvert')] : chips;
}

export interface ShelfCollection {
  readonly collection: Collection;
  /** Each member on this page of cards, with the stage it belongs to. */
  readonly members: ReadonlyMap<string, string>;
}

/** A shelf tile's covers: the first three of its members this gallery has. */
export function shelfCovers(members: ReadonlyMap<string, string>, cards: readonly GalleryCard[]): GalleryCard[] {
  const byKey = new Map(cards.map(card => [card.key, card]));
  return [...members.keys()].flatMap(key => byKey.get(key) ?? []).slice(0, 3);
}

/**
 * The collections the shelf offers: in their featured window, not hidden, and
 * holding at least one card the gallery would show. A seasonal collection
 * shows inside its window wherever the shop is (ADR 0171). The library's copy
 * of a bundled collection (`catalog-<id>`) is one tile with it: the bundled
 * order, then any member only the library has.
 */
export function shelfCollections(collections: readonly Collection[], cards: readonly GalleryCard[], today: string, hidden: readonly string[]): ShelfCollection[] {
  const keys = new Set(cards.map(card => card.key));

  return collections
    // Hiding a tile hides the library's copy of it too.
    .filter(collection => !hidden.includes(collection.id) && !hidden.includes(collection.id.replace(/^catalog-/, '')))
    .filter(({ event }) => !event || (today >= event.feature_start && today < event.feature_end_exclusive && today < event.end_exclusive))
    .map(collection => {
      // A hosted member already installed is a local card under its Playbook's id.
      const installed = new Map((collection.online ?? []).flatMap(member => member.playbook_id ? [[member.setup.id, member.playbook_id] as const] : []));
      const members = collection.items.flatMap(item => [item.setup_id, installed.get(item.setup_id)].filter((key): key is string => key !== undefined && keys.has(key))
        .slice(0, 1).map(key => [key, item.stage] as const));

      return { collection, members: new Map(members) };
    })
    .filter(shelf => shelf.members.size > 0)
    .reduce<ShelfCollection[]>((shelves, shelf) => {
      const base = shelf.collection.id.replace(/^catalog-/, '');
      const twin = shelves.findIndex(other => other.collection.id.replace(/^catalog-/, '') === base);

      if (twin === -1) return [...shelves, shelf];
      const [first, second] = shelf.collection.id === base ? [shelf, shelves[twin]] : [shelves[twin], shelf];
      shelves[twin] = { collection: first.collection, members: new Map([...first.members, ...[...second.members].filter(([key]) => !first.members.has(key))]) };
      return shelves;
    }, [])
    .sort((a, b) => b.collection.priority - a.collection.priority || a.collection.id.localeCompare(b.collection.id));
}
