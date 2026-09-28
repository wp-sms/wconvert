import { expect, it } from 'vitest';
import { isResultFirst } from '@loader/journey-mode';
import type { TemplateTree } from '@renderer/types';
import finder from '../../pro/modules/journeys/templates/journey-product-finder.json';
import signup from '../../resources/templates/library/journey-email-only.json';
import { upgradeToGraph } from '../../resources/admin/src/builder/structure/graph';
import { addGraphResultSignup, resultAccess } from '../../resources/admin/src/builder/structure/journey';

it('keeps an anonymous result independent of signup', () => {
  expect(isResultFirst(finder.tree as TemplateTree)).toBe(true);
  expect(isResultFirst(signup.tree as TemplateTree)).toBe(false);
  expect(isResultFirst(null)).toBe(false);
});

it.each([false, true])('classifies a graph result by connections after storage reordering (required: %s)', required => {
  const optional = addGraphResultSignup(upgradeToGraph(finder.tree as TemplateTree));
  const tree = resultAccess(optional, required);
  expect(tree.submissions[0].required).toBe(required);
  expect(isResultFirst(tree)).toBe(!required);
  expect(isResultFirst({ ...tree, steps: [...tree.steps].reverse() })).toBe(!required);
});
