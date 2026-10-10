import { expect, it } from 'vitest';
import type { JourneyGraph, TemplateScreen } from '@renderer/types';
import { graphReaches, graphTrace } from '@loader/journey-graph';
import type { Answers } from '@loader/journey-rules';
import fixture from '../fixtures/journey-graph.json';

const steps = fixture.steps as TemplateScreen[];
const graph = fixture.graph as JourneyGraph;

it('asks all relevant follow-ups and rejoins by edge IDs regardless of screen array order', () => {
  expect(graphReaches(graph, 'interests', 'received')).toBe(true);
  expect(graphReaches(graph, 'received', 'interests')).toBe(false);
  for (const example of fixture.cases) {
    const trace = graphTrace(steps, graph, example.answers as Answers);
    expect(trace.indices.map(index => steps[index].id)).toEqual(example.visible);
    expect(trace.answers).toEqual(example.active);
    expect(trace.hidden).toEqual(example.hidden);
    expect(trace.decisions.map(decision => decision.edge)).toEqual(example.edges);
  }
});

/** ADR 0135: a skipped screen with no hidden edge continues along its default edge, in PHP and here alike. */
it('lets a skipped screen fall through along its default edge when it has no hidden edge', () => {
  const graph = fixture.fallthrough.graph as JourneyGraph;
  for (const example of fixture.fallthrough.cases) {
    const trace = graphTrace(steps, graph, example.answers as Answers);
    expect(trace.indices.map(index => steps[index].id)).toEqual(example.visible);
    expect(trace.answers).toEqual(example.active);
    expect(trace.hidden).toEqual(example.hidden);
    expect(trace.decisions.map(decision => decision.edge)).toEqual(example.edges);
    // A skipped screen's decision says it was skipped, though it continued on the default edge.
    expect(trace.decisions.filter(decision => decision.kind === 'hidden').map(decision => decision.from)).toEqual(example.hidden);
  }
});

it('takes the first matching answer edge, even when multiple interests match', () => {
  const when = (value: string) => ({ match: 'all' as const, clauses: [{ question: 'n1', operator: 'includes_any' as const, values: [value] }] });
  const exclusive: JourneyGraph = { entry: 'interests', edges: [
    { id: 'indoor-first', from: 'interests', to: 'indoors', kind: 'answer', when: when('indoors') },
    { id: 'garden-second', from: 'interests', to: 'garden', kind: 'answer', when: when('garden') },
    { id: 'otherwise', from: 'interests', to: 'contact', kind: 'default' },
    { id: 'indoor-merge', from: 'indoors', to: 'contact', kind: 'default' },
    { id: 'garden-merge', from: 'garden', to: 'contact', kind: 'default' },
    { id: 'finish', from: 'contact', to: 'received', kind: 'default' },
  ] };
  const trace = graphTrace(steps, exclusive, { n1: ['garden', 'indoors'], n2: 'bright', n3: 'small' });
  expect(trace.indices.map(index => steps[index].id)).toEqual(['interests', 'indoors', 'contact', 'received']);
  expect(trace.decisions[0]).toEqual({ edge: 'indoor-first', from: 'interests', to: 'indoors', kind: 'answer', priority: 0 });
  expect(trace.answers).toEqual({ n1: ['garden', 'indoors'], n2: 'bright' });
});
