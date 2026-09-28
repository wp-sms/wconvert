import { expect, it } from 'vitest';
import type { TemplateTree } from '@renderer/types';
import { changeTestGuide } from '../../resources/admin/src/builder/structure/changeTestGuide';
import coffee from '../fixtures/journey-graph-coffee.json';
import enquiry from '../fixtures/journey-graph-enquiry.json';
const quiz = coffee.template.tree as unknown as TemplateTree;
it('names actual answers and asks for single and combined interests', () => {
  const hints = changeTestGuide(enquiry as unknown as TemplateTree, 'interests');
  expect(hints.join(' ')).toMatch(/Garden.*Indoor.*separately and together/);
});
it('includes all result rules and first-match and fallback cases', () => {
  const result = quiz.steps.find(screen => screen.kind === 'result')!;
  const hints = changeTestGuide(quiz, result.id).join(' ');
  expect(hints).toContain('Espresso machine');
  expect(hints).toContain('Filter or pour-over');
  expect(hints).toContain('several results, then none');
});
it('describes removal without inventing a live screen or answer', () => {
  expect(changeTestGuide(quiz, 'deleted')).toEqual([expect.stringContaining('no longer appears')]);
});
