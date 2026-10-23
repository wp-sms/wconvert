import { afterEach, expect, it, vi } from 'vitest';
import type { JourneyGraph, TemplateScreen } from '@renderer/types';
import type { Answers } from '@loader/journey-rules';
import paths from '../fixtures/journey-paths.json';
import graphs from '../fixtures/journey-graph.json';

// The production build substitutes this constant; isolated imports exercise both sides.
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

it('preserves legacy visitor paths and answers while omitting editor explanations', async () => {
  const steps = structuredClone(paths.steps) as TemplateScreen[];
  steps[0] = { ...steps[0], paths: [{ to: 'indoors', when: {
    match: 'all', clauses: [{ question: 'q_interest', operator: 'includes_any', values: ['indoors'] }],
  } }, { to: 'garden' }] };
  const { journeyTrace: editor } = await import('@loader/journey-rules');
  vi.stubGlobal('__WCONVERT_VISITOR__', true);
  vi.resetModules();
  const { journeyTrace: visitor } = await import('@loader/journey-rules');
  for (const example of paths.cases) {
    const answers = example.answers as Answers;
    const expected = editor(steps, answers);
    expect(visitor(steps, answers)).toEqual({ indices: expected.indices, answers: expected.answers, decisions: [], skips: [] });
  }
  expect(editor(steps, { q_interest: ['indoors'] }).skips).not.toEqual([]);
});

it('preserves graph routing, hidden-edge fallthrough and active answers without editor trace records', async () => {
  const steps = graphs.steps as TemplateScreen[];
  const { graphTrace: editor } = await import('@loader/journey-graph');
  vi.stubGlobal('__WCONVERT_VISITOR__', true);
  vi.resetModules();
  const { graphTrace: visitor } = await import('@loader/journey-graph');
  for (const fixture of [graphs, graphs.fallthrough]) for (const example of fixture.cases) {
    const graph = fixture.graph as JourneyGraph;
    const answers = example.answers as Answers;
    const expected = editor(steps, graph, answers);
    expect(visitor(steps, graph, answers)).toEqual({ indices: expected.indices, answers: expected.answers, decisions: [], hidden: [] });
    expect(expected.decisions.length).toBeGreaterThan(0);
  }
});
