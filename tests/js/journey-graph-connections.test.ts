import { expect, it } from 'vitest';
import type { TemplateTree } from '@renderer/types';
import { addGraphConnection, canTargetGraphScreen, reconnectGraphEdge } from '../../resources/admin/src/builder/structure/graphConnections';
import { journeyReadinessIssues } from '../../resources/admin/src/builder/structure/journeyReadiness';
import fixture from '../fixtures/journey-graph-enquiry.json';

const tree = fixture as unknown as TemplateTree;

it('does not carry the old five-branch UI limit into flexible graphs', () => {
  const extra = Array.from({ length: 6 }, (_, index) => ({ id: `extra_${index}`, name: `Route ${index + 1}`, kind: 'content' as const,
    content: { type: 'stack' as const, children: [] } }));
  let next: TemplateTree = { ...tree, steps: [...tree.steps, ...extra] };
  for (const screen of extra) next = addGraphConnection(next, 'interests', screen.id);
  expect(next.graph!.edges.filter(edge => edge.from === 'interests' && edge.kind === 'answer').map(edge => edge.to))
    .toEqual(extra.map(screen => screen.id));
});

it('draws branches across storage order without guessing an answer or replacing the fallback', () => {
  const next = addGraphConnection(tree, 'interests', 'contact');
  expect(next.graph!.edges.slice(0, -1)).toEqual(tree.graph!.edges);
  const added = next.graph!.edges.at(-1)!;
  expect(added).toMatchObject({ from: 'interests', to: 'contact', kind: 'answer',
    when: { clauses: [{ question: 'n1', values: [''] }] } });
  expect(journeyReadinessIssues(next).some(issue => issue.repair?.edgeId === added.id)).toBe(true);
  const second = addGraphConnection(next, 'interests', 'balcony');
  expect(second.graph!.edges.filter(edge => edge.from === 'interests' && edge.kind === 'answer').map(edge => edge.to))
    .toEqual(['contact', 'balcony']);
});

it('refuses self loops, cycles through hidden paths, duplicate routes and unknown screens', () => {
  for (const [from, to] of [['garden', 'garden'], ['contact', 'interests'], ['balcony', 'garden'],
    ['interests', 'garden'], ['interests', 'missing'], ['missing', 'contact'], ['received', 'contact']]) {
    expect(addGraphConnection(tree, from, to)).toBe(tree);
  }
  expect(canTargetGraphScreen(tree, 'contact', 'garden')).toBe(false);
});

it('repairs a missing default connection without replacing the hidden destination', () => {
  const broken = { ...tree, graph: { ...tree.graph!, edges: tree.graph!.edges.filter(edge => edge.id !== 'garden_next') } };
  const next = addGraphConnection(broken, 'garden', 'balcony');
  expect(next).not.toBe(broken);
  expect(next.graph!.edges.at(-1)).toMatchObject({ from: 'garden', to: 'balcony', kind: 'default' });
  expect(next.graph!.edges.find(edge => edge.from === 'garden' && edge.kind === 'hidden'))
    .toEqual(tree.graph!.edges.find(edge => edge.from === 'garden' && edge.kind === 'hidden'));
  const branched = addGraphConnection(tree, 'interests', 'contact');
  const missingFallback = { ...branched, graph: { ...branched.graph!, edges: branched.graph!.edges.filter(edge => edge.id !== 'start') } };
  expect(addGraphConnection(missingFallback, 'interests', 'contact').graph!.edges.at(-1))
    .toMatchObject({ from: 'interests', to: 'contact', kind: 'default' });
});

it('reconnects an edge without changing its condition, priority, identity or other edges', () => {
  const withBranch = addGraphConnection(tree, 'interests', 'contact');
  const edge = withBranch.graph!.edges.at(-1)!;
  const next = reconnectGraphEdge(withBranch, edge.id, 'balcony');
  expect(next.graph!.edges.at(-1)).toEqual({ ...edge, to: 'balcony' });
  expect(next.graph!.edges.slice(0, -1)).toEqual(withBranch.graph!.edges.slice(0, -1));
  expect(reconnectGraphEdge(next, edge.id, 'interests')).toBe(next);
  expect(reconnectGraphEdge(next, edge.id, 'missing')).toBe(next);
  expect(reconnectGraphEdge(next, 'missing', 'contact')).toBe(next);
});
