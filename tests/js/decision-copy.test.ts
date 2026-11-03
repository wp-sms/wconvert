import { expect, it } from 'vitest';
import { decisionCopy } from '../../resources/admin/src/optins/decisionCopy';

/** #292: a test's delete takes its variants with it, so the words count them. */
it('counts the variants a test delete takes with it, and keeps a lone variant’s words', () => {
  expect(decisionCopy('delete', false, 'Spring sale', 2)).toEqual({
    title: 'Delete this A/B test?',
    description: '“Spring sale” and its 2 variants stop showing. Leads and results are kept.',
    confirmLabel: 'Delete test',
  });
  expect(decisionCopy('delete', false, 'Spring sale', 0).title).toBe('Delete this campaign?');
  expect(decisionCopy('delete', true, 'Spring sale (B)', 0).confirmLabel).toBe('Delete variant');
});

/** The list and the report say the same two honest clauses about choosing a variant. */
it('says choosing a variant proves nothing and publishes nothing', () => {
  const { description } = decisionCopy('winner', true, 'Spring sale (B)', 0);
  expect(description).toContain('not a statistically proven winner');
  expect(description).toContain('an unpublished design stays unpublished');
});

it('counts in the site’s digits', () => {
  document.documentElement.lang = 'fa-IR';
  expect(decisionCopy('delete', false, 'Spring sale', 2).description).toContain('۲');
  document.documentElement.lang = '';
});
