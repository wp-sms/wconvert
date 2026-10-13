import { expect, it } from 'vitest';
import type { TemplateTree } from '@renderer/types';
import { isRefusal, straightenedJourney } from '../../resources/admin/src/builder/structure/straighten';
import { freshScreen, usesJourneyElements, walkNodes } from '../../resources/admin/src/builder/structure/journey';
import { graphDisplayOrder } from '../../resources/admin/src/builder/structure/graph';
import graph from '../fixtures/journey-graph-enquiry.json';
import enquiry from '../../pro/modules/journeys/templates/journey-service-enquiry.json';
import finder from '../../pro/modules/journeys/templates/journey-product-finder.json';
import guide from '../../pro/modules/journeys/templates/journey-content-guide.json';

/** "Make it a straight campaign" on a free install (ADR 0147). */
const straight = (tree: TemplateTree): TemplateTree => {
  const result = straightenedJourney(tree);
  if (isRefusal(result)) throw new Error(result.reason);
  return result;
};

it('leaves nothing this site can’t display, in the order the Flow map shows', () => {
  const tree = graph as unknown as TemplateTree;
  const next = straight(tree);

  expect(usesJourneyElements(next)).toBe(false);
  expect(next).not.toHaveProperty('graph');
  const order = graphDisplayOrder(tree).map(index => tree.steps[index].id);
  const kept = next.steps.map(screen => screen.id);
  expect(kept).toEqual(order.filter(id => kept.includes(id)));
  // Screens that only asked go; the form and the ending stay.
  expect(kept).toEqual(['contact', 'received']);
  expect(next.submissions).toEqual(tree.submissions);
});

it('takes the first screen’s Back button with the screens before it', () => {
  const next = straight(graph as unknown as TemplateTree);
  expect(walkNodes(next.steps[0].content).some(node => node.type === 'button' && 'action' in node && node.action === 'back')).toBe(false);
});

it('straightens a linear journey too', () => {
  const next = straight(enquiry.tree as unknown as TemplateTree);
  expect(usesJourneyElements(next)).toBe(false);
  expect(next.steps.at(-1)?.kind).toBe('acknowledgement');
});

it('refuses, saying why, where nothing or too much would be left', () => {
  const nothing = straightenedJourney(finder.tree as unknown as TemplateTree);
  expect(isRefusal(nothing) && nothing.reason).toMatch(/Start from another design/);

  const base = enquiry.tree as unknown as TemplateTree;
  let tree = base;
  for (let at = 0; at < 6; at++) tree = { ...tree, steps: [freshScreen(tree, 'content'), ...tree.steps] };
  const tooMany = straightenedJourney(tree);
  expect(isRefusal(tooMany) && tooMany.reason).toMatch(/up to 7 screens/);
});

it('makes the first signup the required one, without its "No thanks"', () => {
  const next = straight(guide.tree as unknown as TemplateTree);
  expect(next.submissions[0].required).toBe(true);
  const first = next.submissions[0].id;
  expect(next.steps.flatMap(screen => walkNodes(screen.content)).some(node => node.type === 'button' && 'action' in node && node.action === 'skip' && 'submission' in node && node.submission === first)).toBe(false);
});
