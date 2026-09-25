import { expect, it } from 'vitest';
import type { TemplateTree } from '@renderer/types';
import { graphTrace } from '@loader/journey-graph';
import { freshScreen, referencedJourney, replaceAnswer, unreachableScreens, usedBy } from '../../resources/admin/src/builder/structure/journey';
import { graphDisplayOrder, graphRemoval, graphTargets, insertOnGraphEdge } from '../../resources/admin/src/builder/structure/graph';
import fixture from '../fixtures/journey-graph-enquiry.json';

const base = fixture as unknown as TemplateTree;

it('inserts on a named edge without changing the original condition or unrelated routes', () => {
  const before = graphTrace(base.steps, base.graph!, { n1: ['balcony'], n4: 'large' });
  const inserted = insertOnGraphEdge(base, 'balcony_next', freshScreen(base, 'content'));
  const newScreen = inserted.steps.at(-1)!;
  expect(inserted.graph?.edges.find(edge => edge.id === 'balcony_next')?.to).toBe(newScreen.id);
  expect(inserted.graph?.edges.find(edge => edge.from === newScreen.id && edge.kind === 'default')?.to).toBe('contact');
  const after = graphTrace(inserted.steps, inserted.graph!, { n1: ['balcony'], n4: 'large' });
  expect(after.indices.map(index => inserted.steps[index].id)).toEqual([
    'interests', 'balcony', newScreen.id, 'contact', 'received',
  ]);
  expect(after.decisions.filter(edge => edge.from !== 'balcony' && edge.from !== newScreen.id)).toEqual(before.decisions.filter(edge => edge.from !== 'balcony'));
  expect(unreachableScreens(inserted)).toEqual([]);
  expect(graphDisplayOrder(inserted).map(index => inserted.steps[index].id)).toEqual([
    'interests', 'garden', 'indoors', 'balcony', newScreen.id, 'contact', 'received',
  ]);
});

it('gives a conditional inserted screen an explicit hidden continuation', () => {
  const screen = { ...freshScreen(base, 'input'), when: base.steps.find(step => step.id === 'garden')!.when };
  const next = insertOnGraphEdge(base, 'start', screen);
  expect(next.graph?.edges.filter(edge => edge.from === screen.id).map(edge => [edge.kind, edge.to])).toEqual([
    ['default', 'garden'], ['hidden', 'garden'],
  ]);
});

it('keeps explicit field ownership when storage order changes', () => {
  const reordered = referencedJourney({ ...base, steps: [...base.steps].reverse() });
  expect(reordered.submissions[0]).toEqual(base.submissions[0]);
  expect(graphTrace(reordered.steps, reordered.graph!, { n1: ['garden'] }).indices.map(index => reordered.steps[index].id))
    .toEqual(['interests', 'garden', 'contact', 'received']);
});

it('protects graph conditions when replacing a referenced answer', () => {
  const graph = { ...base.graph!, edges: [...base.graph!.edges, { id: 'branch', from: 'interests', to: 'balcony', kind: 'answer' as const,
    when: { match: 'all' as const, clauses: [{ question: 'n1', operator: 'includes_any' as const, values: ['garden'] }] } }] };
  const tree = { ...base, graph };
  expect(usedBy(tree, 'n1')).toContain('interests');
  const changed = replaceAnswer(tree, 'n1', 'garden', 'balcony');
  expect(changed.graph?.edges.find(edge => edge.id === 'branch')?.when?.clauses[0].values).toEqual(['balcony']);
  expect(changed.steps.find(screen => screen.id === 'interests')?.content).not.toEqual(base.steps.find(screen => screen.id === 'interests')?.content);
});

it('offers merge targets but rules out cycles', () => {
  expect(graphTargets(base, 'balcony').map(screen => screen.id)).toContain('contact');
  expect(graphTargets(base, 'balcony').map(screen => screen.id)).not.toContain('interests');
  expect(graphTargets(base, 'contact').map(screen => screen.id)).not.toContain('garden');
});

it('deletes an unreferenced screen as one reroute and preserves all incoming edge identities', () => {
  const added = insertOnGraphEdge(base, 'balcony_next', freshScreen(base, 'content'));
  const screenId = added.steps.at(-1)!.id;
  const removed = graphRemoval(added, screenId)!;
  expect(removed.destination).toBe('contact');
  expect(removed.incoming).toBe(1);
  expect(removed.next.graph?.edges.find(edge => edge.id === 'balcony_next')?.to).toBe('contact');
  expect(removed.next.steps).toEqual(base.steps);
  expect(unreachableScreens(removed.next)).toEqual([]);
  expect(graphRemoval(base, 'interests')).toBeNull();
  expect(graphRemoval(base, 'contact')).toBeNull();
  expect(graphRemoval(base, 'received')).toBeNull();
});
