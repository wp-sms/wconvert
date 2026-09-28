import { expect, it } from 'vitest';
import type { TemplateTree } from '@renderer/types';
import { answerReferences } from '../../resources/admin/src/builder/structure/answerReferences';
import fixture from '../fixtures/journey-graph-enquiry.json';
it('addresses each use separately and filters removal review to the selected answer', () => {
  const tree = fixture as TemplateTree;
  const next: TemplateTree = { ...tree, graph: { ...tree.graph!, edges: [...tree.graph!.edges,
    { id: 'branch', from: 'interests', to: 'contact', kind: 'answer', when: { match: 'all', clauses: [{ question: 'n1', operator: 'includes_any', values: ['garden'] }] } },
  ] }, steps: [...tree.steps, { id: 'results', name: 'Your result', kind: 'result', content: { type: 'stack', children: [] }, results: [
    { id: 'garden-result', heading: 'Garden picks', body: '', product_ids: [], when: { match: 'all', clauses: [{ question: 'n1', operator: 'includes_any', values: ['garden'] }] } },
  ] }] };
  const references = answerReferences(next, 'n1', 'garden');
  expect(references).toHaveLength(3);
  expect(references.map(ref => ref.repair)).toEqual(expect.arrayContaining([
    { screenId: 'garden', section: 'content' },
    { screenId: 'interests', section: 'paths', pathPriority: 0, edgeId: 'branch' },
    { screenId: 'results', section: 'content', resultId: 'garden-result' },
  ]));
  expect(references.some(ref => ref.label === 'Balcony details')).toBe(false);
});
