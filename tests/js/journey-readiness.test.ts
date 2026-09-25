import { expect, it } from 'vitest';
import type { TemplateTree } from '@renderer/types';
import { journeyReadinessIssues } from '../../resources/admin/src/builder/structure/journeyReadiness';
import fixture from '../fixtures/journey-graph-enquiry.json';

const base = fixture as unknown as TemplateTree;

it('names the exact graph path with an unfinished answer and its repair target', () => {
  const tree: TemplateTree = { ...base, graph: { ...base.graph!, edges: [...base.graph!.edges,
    { id: 'new_branch', from: 'interests', to: 'balcony', kind: 'answer',
      when: { match: 'all', clauses: [{ question: 'n1', operator: 'includes_any', values: [] }] } },
  ] } };
  expect(journeyReadinessIssues(tree)).toContainEqual({ key: 'edge:new_branch',
    said: 'Choose an answer for the path from “Interests” to “Balcony details”.',
    repair: { screenId: 'interests', section: 'paths', edgeId: 'new_branch' } });
});

it('locates a disconnected screen by stable ID even when names can change', () => {
  const tree: TemplateTree = { ...base, graph: { ...base.graph!, edges: base.graph!.edges.filter(edge => edge.id !== 'submitted') } };
  expect(journeyReadinessIssues(tree)).toContainEqual({ key: 'unreachable:received',
    said: 'No journey path reaches “Received”. Connect or remove this screen.',
    repair: { screenId: 'received', section: 'content' } });
});
