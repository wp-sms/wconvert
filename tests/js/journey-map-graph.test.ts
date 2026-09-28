import { expect, it } from 'vitest';
import type { TemplateTree } from '@renderer/types';
import { hiddenFor, routesFor } from '../../resources/admin/src/builder/JourneyMap';
import fixture from '../fixtures/journey-graph-enquiry.json';

it('draws stored connections from graph IDs rather than adjacent array positions', () => {
  const tree = fixture as unknown as TemplateTree;
  expect(tree.steps[0].id).toBe('contact');
  expect(routesFor(tree, 0).map(edge => edge.to)).toEqual(['received']);
  expect(routesFor(tree, 2).map(edge => edge.to)).toEqual(['garden']);
  expect(hiddenFor(tree, 1)).toBe('balcony');
  expect(hiddenFor(tree, 5)).toBe('indoors');
  expect(routesFor(tree, 3)).toEqual([]);
});

it('shows answer branches in priority order before Everyone else', () => {
  const base = fixture as unknown as TemplateTree;
  const tree: TemplateTree = { ...base, graph: { ...base.graph!, edges: [...base.graph!.edges,
    { id: 'answer_a', from: 'interests', to: 'indoors', kind: 'answer', when: {
      match: 'all', clauses: [{ question: 'n1', operator: 'includes_any', values: ['indoors'] }],
    } },
    { id: 'answer_b', from: 'interests', to: 'balcony', kind: 'answer', when: {
      match: 'all', clauses: [{ question: 'n1', operator: 'includes_any', values: ['balcony'] }],
    } },
  ] } };
  expect(routesFor(tree, 2).map(edge => 'id' in edge ? edge.id : '')).toEqual(['answer_a', 'answer_b', 'start']);
});
