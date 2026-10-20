import { describe, expect, it } from 'vitest';
import type { QuestionCondition, TemplateTree } from '@renderer/types';
import { answerLinesOverlap, resultsMayOverlap } from '../../resources/admin/src/builder/structure/conditionText';

const question = (id: string, answer_type: 'single' | 'multi') => ({ type: 'question', id, label: id, answer_type,
  options: [{ value: 'a', label: 'Apples' }, { value: 'b', label: 'Bread' }, { value: 'c', label: 'Cheese' }] });
const tree = { v: 2, submissions: [], steps: [
  { id: 's', name: 'Start', kind: 'input', content: { type: 'stack', children: [question('one', 'single'), question('many', 'multi')] } },
] } as unknown as TemplateTree;
const rule = (q: string, operator: 'is' | 'is_not' | 'includes_any', ...values: string[]): QuestionCondition => ({ match: 'all', clauses: [{ question: q, operator, values }] });

describe('answer lines one visitor can match twice', () => {
  it('names one answer from each line of a choose-several question', () => {
    expect(answerLinesOverlap(tree, [{ when: rule('many', 'includes_any', 'a') }, { when: rule('many', 'includes_any', 'b') }]))
      .toEqual({ first: 0, second: 1, answers: ['Apples', 'Bread'] });
  });

  it('finds an answer two choose-one lines share', () => {
    expect(answerLinesOverlap(tree, [{ when: rule('one', 'is', 'a', 'b') }, { when: rule('one', 'is', 'b', 'c') }]))
      .toEqual({ first: 0, second: 1, answers: ['Bread', 'Bread'] });
  });

  it('says nothing about lines that cannot both match', () => {
    expect(answerLinesOverlap(tree, [{ when: rule('one', 'is', 'a') }, { when: rule('one', 'is', 'b', 'c') }])).toBeNull();
    expect(answerLinesOverlap(tree, [{ when: rule('many', 'includes_any', 'a') }, { when: rule('one', 'is', 'a') }])).toBeNull();
    expect(answerLinesOverlap(tree, [{ when: rule('many', 'includes_any', '') }, { when: rule('many', 'includes_any', 'b') }])).toBeNull();
  });
});

describe('results that may overlap', () => {
  const result = (when: QuestionCondition) => ({ id: 'r', heading: 'R', when });
  it('compares every value of “is any of”', () => {
    expect(resultsMayOverlap(tree, result(rule('one', 'is', 'a', 'b')), result(rule('one', 'is', 'c')))).toBe(false);
    expect(resultsMayOverlap(tree, result(rule('one', 'is', 'a', 'b')), result(rule('one', 'is', 'b')))).toBe(true);
    expect(resultsMayOverlap(tree, result(rule('one', 'is', 'a', 'b')), result(rule('one', 'is_not', 'a', 'b')))).toBe(false);
  });
});
