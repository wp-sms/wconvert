import { describe, expect, it } from 'vitest';
import { facetOptions, matchesEntryQuery, matchesFacets, matchesQuery, narrow } from '../../resources/admin/src/builder/facets';
import type { TemplateIndexEntry, TemplateLabelsWithFacets } from '../../resources/admin/src/templates/api';

const entry = (id: string, captures: string[], overrides: Partial<TemplateIndexEntry['facets']> = {}): TemplateIndexEntry => ({
  id,
  name: id,
  display_type: 'popup',
  availability: 'ready',
  tier: 'free',
  facets: { captures, shape: 'stack', has_image: false, asks_consent: false, act: 'submit', ...overrides },
});

const designs = [
  entry('Fieldwork', ['email'], { shape: 'split', has_image: true }),
  entry('A quieter frequency', ['email'], { shape: 'panel' }),
  entry('Two channels', ['email', 'phone'], { shape: 'row' }),
  entry('A personal invitation', ['name', 'phone'], { shape: 'row' }),
  entry('The summer archive', [], { act: 'click' }),
];

const labels: Pick<TemplateLabelsWithFacets, 'facetValues' | 'fields' | 'params'> = {
  fields: { email: 'Email address', name: 'Name', phone: 'Phone number' },
  params: { submit: 'Sends the form', link: 'Goes somewhere else' },
  facetValues: {
    'captures.email': 'Email address', 'captures.name': 'Name', 'captures.phone': 'Phone number',
    'shape.stack': 'Column', 'shape.row': 'Row', 'shape.split': 'Side by side', 'shape.panel': 'Panel',
    'has_image.true': 'With a picture',
  },
};

describe('merchant field requirements', () => {
  it('requires every selected field without excluding optional extra fields', () => {
    expect(narrow(designs, 'popup', { captures: ['email', 'phone'] }, '', labels).map((design) => design.id))
      .toEqual(['Two channels']);
    expect(matchesFacets(designs[3], { captures: ['phone'] })).toBe(true);
    expect(matchesFacets(designs[3], { captures: ['email'] })).toBe(false);
  });

  it('keeps alternative layouts as OR and respects the selected interaction', () => {
    expect(narrow(designs, 'popup', { shape: ['split', 'row'], act: ['submit'] }, '', labels))
      .toEqual([designs[0], designs[2], designs[3]]);
    expect(narrow(designs, 'popup', { act: ['click'] }, '', labels)).toEqual([designs[4]]);
  });
});

describe('searching names and actual features', () => {
  it('finds an email form whose name never mentions email', () => {
    expect(narrow(designs, 'popup', {}, 'email form', labels)).toEqual(designs.slice(0, 3));
    expect(narrow(designs, 'popup', {}, 'email picture', labels)).toEqual([designs[0]]);
    expect(narrow(designs, 'popup', {}, 'phone email', labels)).toEqual([designs[2]]);
  });

  it('searches the translated features shown in the controls', () => {
    const translated = { ...labels, facetValues: { ...labels.facetValues,
      'captures.email': 'Adresse électronique', 'has_image.true': 'Avec une image', 'shape.split': 'Côte à côte',
    } };
    expect(matchesEntryQuery(designs[0], 'electronique image', translated)).toBe(true);
    expect(matchesEntryQuery(designs[0], 'cote', translated)).toBe(true);
    expect(matchesEntryQuery(designs[1], 'image', translated)).toBe(false);
  });

  it('keeps name matching insensitive to case, accents and Unicode composition', () => {
    expect(matchesQuery('Café collection', 'CAFE')).toBe(true);
    expect(matchesQuery('Cafe\u0301 collection', 'CAFÉ')).toBe(true);
    expect(matchesQuery('Café collection', 'cafe\u0301')).toBe(true);
    expect(matchesQuery('Fieldwork', '  field  ')).toBe(true);
    expect(matchesQuery('Fieldwork', 'ledger')).toBe(false);
  });

  it('does not invent goals, mobile capability or screens absent from the index', () => {
    for (const query of ['newsletter', 'mobile', 'success', 'thank you']) {
      expect(narrow(designs, 'popup', {}, query, labels)).toEqual([]);
    }
    expect(narrow(designs, 'popup', {}, 'link', labels)).toEqual([designs[4]]);
  });
});

describe('facet choices and counts', () => {
  it('omits values absent from this display type and preserves vocabulary order', () => {
    expect(facetOptions(designs, 'shape', ['stack', 'row', 'split', 'grid', 'panel', 'media'], {}, '', labels))
      .toEqual([{ value: 'stack', count: 1 }, { value: 'row', count: 2 }, { value: 'split', count: 1 }, { value: 'panel', count: 1 }]);
  });

  it('counts additional required fields against the existing field, query and action constraints', () => {
    expect(facetOptions(designs, 'captures', ['email', 'name', 'phone'], { captures: ['email'], act: ['submit'] }, '', labels))
      .toEqual([{ value: 'email', count: 3 }, { value: 'name', count: 0 }, { value: 'phone', count: 1 }]);
    expect(facetOptions(designs, 'captures', ['email', 'phone'], { act: ['submit'] }, 'picture', labels))
      .toEqual([{ value: 'email', count: 1 }, { value: 'phone', count: 0 }]);
  });

  it('keeps selected zero-result values available for removal', () => {
    expect(facetOptions(designs, 'shape', ['grid', 'row'], { shape: ['grid'], captures: ['email', 'phone'] }, '', labels))
      .toEqual([{ value: 'grid', count: 0 }, { value: 'row', count: 1 }]);
  });
});
