import { expect, it } from 'vitest';
import type { TemplateTree } from '@renderer/types';
import { graphTrace } from '../../resources/loader/src/journey-graph';
import { journeyTrace, type Answers } from '../../resources/loader/src/journey-rules';
import { journeyTestProgress } from '../../resources/admin/src/builder/structure/journeyTestProgress';
import fixture from '../fixtures/journey-graph.json';

const tree = { v: 3, steps: fixture.steps, graph: fixture.graph, submissions: [] } as unknown as TemplateTree;
const index = (id: string) => tree.steps.findIndex(screen => screen.id === id);
const progress = (at: string, path: string[], answers: Answers = {}) => journeyTestProgress(tree, index(at), path.map(index), graphTrace(tree.steps, tree.graph!, answers));
it('does not turn missing answers into confirmed skips before the visitor continues', () => {
  const result = progress('interests', ['interests']);
  expect(result.decisions).toEqual([]);
  expect(result.states[index('interests')]).toBe('current');
  expect(result.states.filter(state => state === 'pending')).toHaveLength(4);
});
it('records hidden screens only after traversing their skip connections', () => {
  const result = progress('indoors', ['interests', 'indoors'], { n1: ['indoors'] });
  expect(result.decisions.map(decision => 'edge' in decision && decision.edge)).toEqual(['e1', 'e3']);
  expect(result.states[index('garden')]).toBe('hidden');
  expect(result.states[index('contact')]).toBe('pending');
});
it('keeps future skips provisional and restores them after Back, even with retained answers', () => {
  const answers = { n1: ['garden'], n3: 'small' };
  expect(progress('garden', ['interests', 'garden'], answers).states[index('indoors')]).toBe('pending');
  expect(progress('contact', ['interests', 'garden', 'contact'], answers).states[index('indoors')]).toBe('hidden');
  expect(progress('interests', ['interests'], answers).decisions).toEqual([]);
  expect(progress('interests', ['interests'], answers).states[index('garden')]).toBe('pending');
});
it('distinguishes a completed exclusive branch from its still-pending alternatives after Back', () => {
  const branched: TemplateTree = { ...tree, graph: { ...tree.graph!, edges: [
    { id: 'branch', from: 'interests', to: 'garden', kind: 'answer', when: { match: 'all', clauses: [{ question: 'n1', operator: 'includes_any', values: ['garden'] }] } },
    { id: 'else', from: 'interests', to: 'indoors', kind: 'default' },
    ...tree.graph!.edges.filter(edge => edge.from !== 'interests').map(edge => edge.from === 'garden' ? { ...edge, to: 'contact' } : edge),
  ] } };
  const trace = graphTrace(branched.steps, branched.graph!, { n1: ['garden'] });
  const result = journeyTestProgress(branched, index('garden'), [index('interests'), index('garden')], trace);
  expect(result.states[index('indoors')]).toBe('bypassed');
  expect(result.states[index('contact')]).toBe('pending');
  expect(journeyTestProgress(branched, index('interests'), [index('interests')], trace).states[index('indoors')]).toBe('pending');
});
it('limits explanations to the reached prefix in legacy ordered journeys too', () => {
  const legacy: TemplateTree = { ...tree, v: 2, graph: undefined, steps: ['interests', 'garden', 'indoors', 'contact', 'received'].map(id => tree.steps[index(id)]) };
  const trace = journeyTrace(legacy.steps, { n1: ['indoors'] });
  expect(journeyTestProgress(legacy, 0, [0], trace).decisions).toEqual([]);
  const result = journeyTestProgress(legacy, 2, [0, 2], trace);
  expect(result.states).toEqual(['visited', 'hidden', 'current', 'pending', 'pending']);
  expect(result.decisions.map(decision => decision.from)).toEqual([0, 1]);
});
