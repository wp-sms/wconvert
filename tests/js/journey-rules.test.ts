import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/journey-rules.json';
import paths from '../fixtures/journey-paths.json';
import type { TemplateScreen } from '@renderer/types';
import { activeAnswers, chooseResult, journeyPath, journeyTrace, matches, visibleScreens, type Answers } from '@loader/journey-rules';

const steps = fixture.steps as TemplateScreen[];

describe('ordered journey rules', () => {
  it('matches the shared PHP fixtures and clears hidden dependent answers', () => {
    for (const example of fixture.cases) {
      const active = activeAnswers(steps, example.answers as Answers);
      expect(active).toEqual(example.active);
      expect(visibleScreens(steps, example.answers as Answers).map(step => step.id)).toEqual(example.visible);
      expect(chooseResult(steps[3].results ?? [], active)?.id).toBe(example.result);
    }
  });

  it('never treats an absent answer as a negative match', () => {
    expect(matches({ match: 'all', clauses: [{ question: 'q_project', operator: 'is_not', values: ['garden'] }] }, {})).toBe(false);
  });
});

describe('forward paths', () => {
  it('asks every relevant independent follow-up and keeps still-relevant answers', () => {
    const steps = paths.steps as TemplateScreen[];
    for (const example of paths.cases) {
      expect(journeyPath(steps, example.answers as Answers).indices.map(index => steps[index].id)).toEqual(example.visible);
      expect(activeAnswers(steps, example.answers as Answers)).toEqual(example.active);
    }
  });

  it('takes only the first matching explicit branch, then rejoins before capture', () => {
    const steps = structuredClone(paths.steps) as TemplateScreen[];
    const condition = (value: string) => ({ match: 'all' as const, clauses: [{ question: 'q_interest', operator: 'includes_any' as const, values: [value] }] });
    steps[0] = { ...steps[0], paths: [{ to: 'garden', when: condition('garden') }, { to: 'indoors', when: condition('indoors') }, { to: 'contact' }] };
    steps[1] = { ...steps[1], paths: [{ to: 'contact' }] };
    const both = { q_interest: ['garden', 'indoors'], q_garden: 'small', q_indoor: 'bright' };
    expect(visibleScreens(steps, both).map(screen => screen.id)).toEqual(['interests', 'garden', 'contact', 'received']);
    expect(activeAnswers(steps, both)).toEqual({ q_interest: ['garden', 'indoors'], q_garden: 'small' });
    expect(visibleScreens(steps, { q_interest: ['indoors'] }).map(screen => screen.id)).toEqual(['interests', 'indoors', 'contact', 'received']);
  });

  it('does not take outgoing paths from a screen hidden by its condition', () => {
    const steps = structuredClone(paths.steps) as TemplateScreen[];
    steps[1] = { ...steps[1], paths: [{ to: 'contact' }] };
    expect(visibleScreens(steps, { q_interest: ['indoors'], q_indoor: 'bright' }).map(screen => screen.id))
      .toEqual(['interests', 'indoors', 'contact', 'received']);
  });

  it('records the chosen branch and distinguishes bypassed screens from failed conditions', () => {
    const steps = structuredClone(paths.steps) as TemplateScreen[];
    const condition = (value: string) => ({ match: 'all' as const, clauses: [{ question: 'q_interest', operator: 'includes_any' as const, values: [value] }] });
    steps[0] = { ...steps[0], paths: [{ to: 'indoors', when: condition('indoors') }, { to: 'garden', when: condition('garden') }, { to: 'contact' }] };
    const trace = journeyTrace(steps, { q_interest: ['garden', 'indoors'], q_indoor: 'bright' });
    expect(trace.indices.map(index => steps[index].id)).toEqual(['interests', 'indoors', 'contact', 'received']);
    expect(trace.decisions[0]).toEqual({ from: 0, to: 2, kind: 'route', priority: 0 });
    expect(trace.skips).toContainEqual({ index: 1, reason: 'route', from: 0, to: 2 });
    expect(trace.answers).toEqual({ q_interest: ['garden', 'indoors'], q_indoor: 'bright' });
    const noAnswer = journeyTrace(paths.steps as TemplateScreen[], { q_interest: [] });
    expect(noAnswer.skips).toContainEqual({ index: 1, reason: 'condition', missingQuestions: ['q_interest'] });
    expect(noAnswer.skips).toContainEqual({ index: 2, reason: 'condition', missingQuestions: ['q_interest'] });
  });
});
