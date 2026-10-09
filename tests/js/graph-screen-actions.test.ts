import { expect, it } from 'vitest';
import type { TemplateTree } from '@renderer/types';
import { graphTrace } from '@loader/journey-graph';
import { addGraphScreen, addGraphBranchScreen } from '../../resources/admin/src/builder/structure/graphInsertion';
import { duplicateGraphScreen, moveGraphScreen } from '../../resources/admin/src/builder/structure/graphScreenActions';
import { referencedJourney, walkNodes } from '../../resources/admin/src/builder/structure/journey';
import { graphChangeImpact } from '../../resources/admin/src/builder/structure/graphChangeImpact';
import { graphRemovalPlan, graphRemoval } from '../../resources/admin/src/builder/structure/graphRemoval';
import fixture from '../fixtures/journey-graph-enquiry.json';
const tree = fixture as unknown as TemplateTree;
const route = (draft: TemplateTree, answers: Record<string, string[]>) => graphTrace(draft.steps, draft.graph!, answers).indices.map(index => draft.steps[index].id);
it('duplicates a question with distinct IDs, a working Back action and an unchanged combined save', () => {
  const next = duplicateGraphScreen(tree, tree.graph!.entry);
  const copy = next.steps.at(-1)!;
  expect(route(next, { n1: ['garden'] }).slice(0, 2)).toEqual([tree.graph!.entry, copy.id]);
  const ids = next.steps.flatMap(screen => walkNodes(screen.content).map(node => 'id' in node ? node.id : undefined)).filter(Boolean);
  expect(new Set(ids).size).toBe(ids.length);
  expect(walkNodes(copy.content).some(node => 'action' in node && node.action === 'back')).toBe(true);
  expect(next.submissions).toEqual(tree.submissions);
  expect(duplicateGraphScreen(tree, 'contact')).toBe(tree);
});
it('duplicates an independent follow-up without showing it to visitors who do not match', () => {
  const next = duplicateGraphScreen(tree, 'garden');
  expect(route(next, { n1: ['garden'] })).toContain(next.steps.at(-1)!.id);
  expect(route(next, { n1: ['balcony'] })).not.toContain(next.steps.at(-1)!.id);
});
it('moves a message while retaining node IDs, both continuations and one combined save', () => {
  const original = referencedJourney(addGraphScreen(tree, 'edge:start', 'content'));
  const id = original.steps.at(-1)!.id;
  const next = moveGraphScreen(original, id, 'balcony_next');
  expect(next).not.toBe(original);
  expect(next.steps).toBe(original.steps);
  expect(next.graph!.edges.find(edge => edge.id === 'start')?.to).toBe('garden');
  expect(next.graph!.edges.find(edge => edge.id === 'balcony_next')?.to).toBe(id);
  expect(route(next, { n1: ['balcony'] }).slice(-3)).toEqual([id, 'contact', 'received']);
  expect(next.submissions).toEqual(original.submissions);
  expect(moveGraphScreen(original, 'garden', 'balcony_next')).toBe(original);
  expect(moveGraphScreen(original, 'contact', 'start')).toBe(original);
});
it('does not move a question beyond the screens whose conditions need it', () => {
  const original = referencedJourney(addGraphScreen(tree, 'entry', 'content'));
  expect(moveGraphScreen(original, 'interests', 'balcony_next')).toBe(original);
});
it('adds an exclusive branch with visible last priority and retains earlier matches and fallback', () => {
  const condition = { match: 'all' as const, clauses: [{ question: 'n1', operator: 'includes_any' as const, values: ['garden'] }] };
  const first = addGraphBranchScreen(tree, 'interests', 'content', condition);
  const second = addGraphBranchScreen(first, 'interests', 'input', condition);
  expect(second.graph!.edges.filter(edge => edge.from === 'interests' && edge.kind === 'answer').map(edge => edge.to)).toEqual([first.steps.at(-1)!.id, second.steps.at(-1)!.id]);
  expect(route(second, { n1: ['garden'] })[1]).toBe(first.steps.at(-1)!.id);
  expect(route(second, { n1: ['balcony'] })).toEqual(route(tree, { n1: ['balcony'] }));
  expect(addGraphBranchScreen(tree, 'contact', 'input', condition)).toBe(tree);
  expect(addGraphBranchScreen(tree, 'interests', 'input', { ...condition, clauses: [{ ...condition.clauses[0], values: ['missing'] }] })).toBe(tree);
});
it('creates an ending without a phantom continuation or a submission, leaving the earlier graph intact', () => {
  const next = addGraphScreen(tree, 'edge:submitted', 'ending');
  const ending = next.steps.at(-1)!;
  expect(ending.kind).toBe('acknowledgement');
  expect(next.graph!.edges.some(edge => edge.from === ending.id)).toBe(false);
  expect(next.graph!.edges.find(edge => edge.id === 'submitted')?.to).toBe(ending.id);
  expect(next.submissions).toEqual(tree.submissions);
  expect(walkNodes(ending.content).some(node => 'action' in node && node.action === 'submit')).toBe(false);
  expect(addGraphScreen(tree, 'entry', 'ending')).toBe(tree);
});

it('names a new ending and the skipped save in the impact review', () => {
  const next = addGraphScreen(tree, 'edge:start', 'ending');
  expect(graphChangeImpact(tree, next)).toContain('“All done”');
  expect(graphChangeImpact(tree, next)).toContain('“One enquiry”');
});

it('lets a merchant remove a redundant ending after replacing it, while keeping the final ending protected', () => {
  const next = addGraphScreen(tree, 'edge:submitted', 'ending');
  expect(graphRemovalPlan(next, 'received').reason).toBeNull();
  const removed = graphRemoval(next, 'received')!.next;
  expect(removed.steps.some(screen => screen.id === 'received')).toBe(false);
  expect(graphRemovalPlan(removed, next.steps.at(-1)!.id).reason).not.toBeNull();
});
