import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/journey-rules.json';
import type { TemplateScreen } from '@renderer/types';
import { activeAnswers, chooseResult, matches, visibleScreens, type Answers } from '@loader/journey-rules';

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
