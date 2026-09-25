import { expect, it } from 'vitest';
import type { TemplateScreen, TemplateTree } from '@renderer/types';
import { graphTrace } from '@loader/journey-graph';
import { journeyPath, type Answers } from '@loader/journey-rules';
import { upgradeToGraph } from '../../resources/admin/src/builder/structure/graph';
import fixture from '../fixtures/journey-paths.json';

it('migrates independent follow-ups without changing any visitor path', () => {
  const legacy: TemplateTree = { v: 2, steps: fixture.steps as TemplateScreen[], submissions: [] };
  const upgraded = upgradeToGraph(legacy);
  expect(upgraded.v).toBe(3);
  expect(upgraded.graph?.entry).toBe('interests');
  expect(upgraded.steps.every(screen => !screen.paths)).toBe(true);
  for (const example of fixture.cases) {
    const old = journeyPath(legacy.steps, example.answers as Answers);
    const next = graphTrace(upgraded.steps, upgraded.graph!, example.answers as Answers);
    expect(next.indices).toEqual(old.indices);
    expect(next.answers).toEqual(old.answers);
  }
});

it('migrates first-match branches and hidden-screen fallthrough explicitly', () => {
  const steps = structuredClone(fixture.steps) as TemplateScreen[];
  const when = (value: string) => ({ match: 'all' as const, clauses: [{ question: 'q_interest', operator: 'includes_any' as const, values: [value] }] });
  steps[0] = { ...steps[0], paths: [{ to: 'garden', when: when('garden') }, { to: 'indoors', when: when('indoors') }, { to: 'contact' }] };
  steps[1] = { ...steps[1], paths: [{ to: 'contact' }] };
  const legacy: TemplateTree = { v: 2, steps, submissions: [] };
  const upgraded = upgradeToGraph(legacy);
  const samples: Answers[] = [
    { q_interest: ['garden', 'indoors'], q_garden: 'small', q_indoor: 'bright' },
    { q_interest: ['indoors'], q_indoor: 'bright' },
    { q_interest: [], q_garden: 'small' },
  ];
  for (const answers of samples) {
    const old = journeyPath(legacy.steps, answers);
    const next = graphTrace(upgraded.steps, upgraded.graph!, answers);
    expect(next.indices).toEqual(old.indices);
    expect(next.answers).toEqual(old.answers);
  }
  expect(upgraded.graph?.edges.filter(edge => edge.from === 'garden').map(edge => edge.kind)).toEqual(['default', 'hidden']);
});
