import { expect, it } from 'vitest';
import { decisionCopy } from '../../resources/admin/src/optins/decisionCopy';

/** #292: a test's delete takes its variants with it, so the words count them. */
it('counts the variants a test delete takes with it, and keeps a lone variant’s words', () => {
  expect(decisionCopy('delete', false, 'Spring sale', 2)).toEqual({
    title: 'Delete this A/B test?',
    description: '“Spring sale” and its 2 variants stop showing and leave this list. Their leads and results are kept.',
    confirmLabel: 'Delete test',
  });
  expect(decisionCopy('delete', false, 'Spring sale', 0).title).toBe('Delete this campaign?');
  expect(decisionCopy('delete', true, 'Spring sale (B)', 0).confirmLabel).toBe('Delete variant');
});
