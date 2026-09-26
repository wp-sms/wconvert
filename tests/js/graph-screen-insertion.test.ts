import { expect, it } from 'vitest';
import type { QuestionCondition, TemplateTree } from '@renderer/types';
import { graphTrace } from '@loader/journey-graph';
import { addGraphScreen, graphInsertionLocations } from '../../resources/admin/src/builder/structure/graphInsertion';
import { referencedJourney, walkNodes } from '../../resources/admin/src/builder/structure/journey';
import fixture from '../fixtures/journey-graph-enquiry.json';

const tree = fixture as unknown as TemplateTree;
const when: QuestionCondition = { match: 'all', clauses: [{ question: 'n1', operator: 'includes_any', values: ['balcony'] }] };
const visible = (next: TemplateTree, interests: string[]) => graphTrace(next.steps, next.graph!, { n1: interests }).indices.map(index => next.steps[index].id);

it('inserts before the graph entry without relying on storage order or losing Back navigation', () => {
  const next = referencedJourney(addGraphScreen(tree, 'entry', 'input'));
  const added = next.steps.at(-1)!;
  expect(next.graph!.entry).toBe(added.id);
  expect(next.graph!.edges.slice(0, tree.graph!.edges.length)).toEqual(tree.graph!.edges);
  expect(visible(next, ['garden']).slice(0, 2)).toEqual([added.id, 'interests']);
  expect(walkNodes(added.content).some(node => 'action' in node && node.action === 'back')).toBe(false);
  expect(walkNodes(next.steps.find(screen => screen.id === 'interests')!.content).some(node => 'action' in node && node.action === 'back')).toBe(true);
});

it('preserves exclusive branch identity, priority, condition and destination when adding a screen', () => {
  const branch = { id: 'first', from: 'interests', to: 'contact', kind: 'answer' as const, when };
  const original = { ...tree, graph: { ...tree.graph!, edges: [branch, ...tree.graph!.edges] } };
  const next = addGraphScreen(original, 'edge:first', 'content');
  const added = next.steps.at(-1)!;
  expect(next.graph!.edges[0]).toEqual({ ...branch, to: added.id });
  expect(visible(next, ['balcony'])).toEqual(['interests', added.id, 'contact', 'received']);
  expect(visible(next, ['garden'])).toEqual(visible(original, ['garden']));
});

it('adds an independent follow-up without swallowing the existing visible or hidden continuation', () => {
  const next = addGraphScreen(tree, 'edge:garden_next', 'followup', when, true);
  const added = next.steps.at(-1)!;
  expect(visible(next, ['garden', 'balcony'])).toContain(added.id);
  expect(visible(next, ['balcony'])).toContain(added.id);
  expect(visible(next, ['garden'])).not.toContain(added.id);
  expect(visible(next, ['balcony']).slice(-2)).toEqual(['contact', 'received']);
  expect(next.submissions).toEqual(tree.submissions);
});

it('keeps an ordinary insertion on the chosen path unless the shared hidden path is explicitly included', () => {
  const next = addGraphScreen(tree, 'edge:garden_next', 'input');
  expect(visible(next, ['garden'])).toContain(next.steps.at(-1)!.id);
  expect(visible(next, ['balcony'])).not.toContain(next.steps.at(-1)!.id);
  expect(next.graph!.edges.find(edge => edge.id === 'garden_hidden')).toEqual(tree.graph!.edges.find(edge => edge.id === 'garden_hidden'));
  const both = addGraphScreen(tree, 'edge:garden_next', 'input', undefined, true);
  expect(visible(both, ['balcony'])).toContain(both.steps.at(-1)!.id);
});

it('does not invent a follow-up answer or offer a skipped source question', () => {
  expect(addGraphScreen(tree, 'edge:start', 'followup')).toBe(tree);
  expect(addGraphScreen(tree, 'edge:start', 'followup', { ...when, clauses: [{ ...when.clauses[0], values: ['missing'] }] })).toBe(tree);
  const hidden = graphInsertionLocations(tree).find(item => item.id === 'edge:garden_hidden')!;
  expect(hidden.choices.map(question => question.id)).toContain('n1');
  expect(hidden.choices.map(question => question.id)).not.toContain('n2');
  expect(addGraphScreen(tree, hidden.id, 'followup', { match: 'all', clauses: [{ question: 'n2', operator: 'is', values: ['small'] }] })).toBe(tree);
});

it('allows a message after a save but keeps new enquiry questions before a reachable save', () => {
  const withMessage = addGraphScreen(tree, 'edge:submitted', 'content');
  const afterSave = withMessage.graph!.edges.find(edge => edge.from === withMessage.steps.at(-1)!.id)!;
  expect(addGraphScreen(tree, 'edge:submitted', 'input')).toBe(tree);
  expect(addGraphScreen(withMessage, `edge:${afterSave.id}`, 'input')).toBe(withMessage);
  expect(addGraphScreen(tree, 'edge:balcony_next', 'input')).not.toBe(tree);
});
