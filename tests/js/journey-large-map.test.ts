import { expect, it } from 'vitest';
import type { TemplateTree } from '@renderer/types';
import { graphTrace } from '@loader/journey-graph';
import type { Answers } from '@loader/journey-rules';
import large12 from '../fixtures/journey-graph-large-12.json';
import large20 from '../fixtures/journey-graph-large-20.json';
import { journeyBoundaryIssues } from '../../resources/admin/src/builder/structure/journeyBoundaryReadiness';
import { journeyReadinessIssues } from '../../resources/admin/src/builder/structure/journeyReadiness';
import { questionPath } from '../../resources/admin/src/builder/structure/questionBudget';

const fixtures = [
  { total: 12, tree: large12 as unknown as TemplateTree, gardenQuestions: 4, businessQuestions: 5, maxQuestions: 6 },
  { total: 20, tree: large20 as unknown as TemplateTree, gardenQuestions: 8, businessQuestions: 9, maxQuestions: 10 },
];

const screenIds = (tree: TemplateTree, answers: Answers) => {
  const trace = graphTrace(tree.steps, tree.graph!, answers);
  return { ...trace, ids: trace.indices.map(index => tree.steps[index].id) };
};

it.each(fixtures)('$total-screen fixture is complete and stays within the per-route question limit', ({ total, tree, maxQuestions }) => {
  expect(tree.v).toBe(3);
  expect(tree.steps).toHaveLength(total);
  expect(journeyReadinessIssues(tree)).toEqual([]);
  expect(journeyBoundaryIssues(tree, 'submit')).toEqual([]);
  expect(questionPath(tree)?.count).toBe(maxQuestions);
});

it.each(fixtures)('$total-screen graph matches exclusive arms, falls back, prunes stale answers, and ignores screen order', ({ tree, gardenQuestions, businessQuestions }) => {
  const gardenIds = Array.from({ length: gardenQuestions }, (_, index) => `garden_${String(index + 1).padStart(2, '0')}`);
  const businessIds = Array.from({ length: businessQuestions }, (_, index) => `business_${String(index + 1).padStart(2, '0')}`);
  const gardenRoute = ['interests', ...gardenIds, 'capture', 'received'];
  const businessRoute = ['interests', ...businessIds, 'capture', 'received'];

  const garden = screenIds(tree, { q_interests: 'garden', q_garden_01: 'garden note' });
  expect(garden.ids).toEqual(gardenRoute);
  expect(garden.decisions[0].edge).toBe('choose_garden');
  expect(garden.decisions.at(-1)?.edge).toBe('submitted');

  const business = screenIds(tree, { q_interests: 'business', q_business_01: 'business note' });
  expect(business.ids).toEqual(businessRoute);
  expect(business.decisions[0].edge).toBe('choose_business');

  const fallback = screenIds(tree, { q_interests: 'other' });
  expect(fallback.ids).toEqual(['interests', 'capture', 'received']);
  expect(fallback.decisions[0].edge).toBe('other_to_capture');

  const changedAnswer = screenIds(tree, {
    ...business.answers,
    q_interests: 'garden',
    q_garden_01: 'updated garden note',
    q_business_01: 'stale answer from the previous path',
  });
  expect(changedAnswer.ids).toEqual(gardenRoute);
  expect(changedAnswer.answers).toEqual({ q_interests: 'garden', q_garden_01: 'updated garden note' });

  const reordered = { ...tree, steps: [...tree.steps].reverse() };
  expect(screenIds(reordered, { q_interests: 'garden', q_garden_01: 'garden note' }).ids).toEqual(gardenRoute);
});
