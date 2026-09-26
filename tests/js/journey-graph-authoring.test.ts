import { expect, it } from 'vitest';
import type { TemplateTree } from '@renderer/types';
import { graphTrace } from '@loader/journey-graph';
import { addGraphResultSignup, freshScreen, referencedJourney, replaceAnswer, resultAccess, unreachableScreens, usedBy, walkNodes } from '../../resources/admin/src/builder/structure/journey';
import { graphDisplayOrder, graphRemoval, graphTargets, insertOnGraphEdge, upgradeToGraph } from '../../resources/admin/src/builder/structure/graph';
import fixture from '../fixtures/journey-graph-enquiry.json';
import finder from '../../pro/modules/journeys/templates/journey-product-finder.json';
import guide from '../../pro/modules/journeys/templates/journey-content-guide.json';
import { additionsIn } from '../../resources/admin/src/builder/structure/catalogue';
import { nodesOf } from '../../resources/admin/src/builder/structure/tree';

const base = fixture as unknown as TemplateTree;

it('uses named screens and graph navigation for Design additions after storage reordering', () => {
  const tree = { ...base, steps: [...base.steps].reverse() };
  const offered = (screen: string, type: string) => additionsIn(tree,
    { parent: [tree.steps.findIndex(item => item.id === screen)], key: 'children', index: 0 }, 'submit')
    .find(item => item.type === type)?.refused;
  expect(offered('garden', 'question')).toBeNull();
  expect(offered('contact', 'question')).toBeNull();
  expect(offered('received', 'question')).toMatch(/question screen/);
  expect(offered('received', 'followup')).toBeNull();
  expect(offered('garden', 'followup')).toMatch(/after capture/);
  expect(nodesOf(tree).filter(block => block.level === 1).map(block => block.screenName))
    .toEqual(tree.steps.map(screen => screen.name));
});

it('inserts on a named edge without changing the original condition or unrelated routes', () => {
  const before = graphTrace(base.steps, base.graph!, { n1: ['balcony'], n4: 'large' });
  const inserted = insertOnGraphEdge(base, 'balcony_next', freshScreen(base, 'content'));
  expect(walkNodes(inserted.steps.at(-1)!.content).some(node => node.type === 'button' && 'action' in node && node.action === 'back')).toBe(true);
  const newScreen = inserted.steps.at(-1)!;
  expect(inserted.graph?.edges.find(edge => edge.id === 'balcony_next')?.to).toBe(newScreen.id);
  expect(inserted.graph?.edges.find(edge => edge.from === newScreen.id && edge.kind === 'default')?.to).toBe('contact');
  const after = graphTrace(inserted.steps, inserted.graph!, { n1: ['balcony'], n4: 'large' });
  expect(after.indices.map(index => inserted.steps[index].id)).toEqual([
    'interests', 'balcony', newScreen.id, 'contact', 'received',
  ]);
  expect(after.decisions.filter(edge => edge.from !== 'balcony' && edge.from !== newScreen.id)).toEqual(before.decisions.filter(edge => edge.from !== 'balcony'));
  expect(unreachableScreens(inserted)).toEqual([]);
  expect(graphDisplayOrder(inserted).map(index => inserted.steps[index].id)).toEqual([
    'interests', 'garden', 'indoors', 'balcony', newScreen.id, 'contact', 'received',
  ]);
});

it('gives a conditional inserted screen an explicit hidden continuation', () => {
  const screen = { ...freshScreen(base, 'input'), when: base.steps.find(step => step.id === 'garden')!.when };
  const next = insertOnGraphEdge(base, 'start', screen);
  expect(next.graph?.edges.filter(edge => edge.from === screen.id).map(edge => [edge.kind, edge.to])).toEqual([
    ['default', 'garden'], ['hidden', 'garden'],
  ]);
});

it('keeps later independent follow-ups reachable when an earlier one is hidden', () => {
  const garden = { ...freshScreen(base, 'input'), when: { match: 'all' as const, clauses: [
    { question: 'n1', operator: 'includes_any' as const, values: ['garden'] },
  ] } };
  const first = insertOnGraphEdge(base, 'start', garden);
  const firstDefault = first.graph!.edges.find(edge => edge.from === garden.id && edge.kind === 'default')!;
  const balcony = { ...freshScreen(first, 'input'), when: { match: 'all' as const, clauses: [
    { question: 'n1', operator: 'includes_any' as const, values: ['balcony'] },
  ] } };
  const second = insertOnGraphEdge(first, firstDefault.id, balcony);
  expect(second.graph?.edges.find(edge => edge.from === garden.id && edge.kind === 'hidden')?.to).toBe(balcony.id);
  expect(graphTrace(second.steps, second.graph!, { n1: ['balcony'] }).indices.map(index => second.steps[index].id))
    .toEqual(['interests', balcony.id, 'balcony', 'contact', 'received']);
});

it('keeps explicit field ownership when storage order changes', () => {
  const reordered = referencedJourney({ ...base, steps: [...base.steps].reverse() });
  expect(reordered.submissions[0]).toEqual(base.submissions[0]);
  expect(graphTrace(reordered.steps, reordered.graph!, { n1: ['garden'] }).indices.map(index => reordered.steps[index].id))
    .toEqual(['interests', 'garden', 'contact', 'received']);
});

it('protects graph conditions when replacing a referenced answer', () => {
  const graph = { ...base.graph!, edges: [...base.graph!.edges, { id: 'branch', from: 'interests', to: 'balcony', kind: 'answer' as const,
    when: { match: 'all' as const, clauses: [{ question: 'n1', operator: 'includes_any' as const, values: ['garden'] }] } }] };
  const tree = { ...base, graph };
  expect(usedBy(tree, 'n1')).toContain('interests');
  const changed = replaceAnswer(tree, 'n1', 'garden', 'balcony');
  expect(changed.graph?.edges.find(edge => edge.id === 'branch')?.when?.clauses[0].values).toEqual(['balcony']);
  expect(changed.steps.find(screen => screen.id === 'interests')?.content).not.toEqual(base.steps.find(screen => screen.id === 'interests')?.content);
});

it('offers merge targets but rules out cycles', () => {
  expect(graphTargets(base, 'balcony').map(screen => screen.id)).toContain('contact');
  expect(graphTargets(base, 'balcony').map(screen => screen.id)).not.toContain('interests');
  expect(graphTargets(base, 'contact').map(screen => screen.id)).not.toContain('garden');
});

it('deletes an unreferenced screen as one reroute and preserves all incoming edge identities', () => {
  const added = insertOnGraphEdge(base, 'balcony_next', freshScreen(base, 'content'));
  const screenId = added.steps.at(-1)!.id;
  const removed = graphRemoval(added, screenId)!;
  expect(removed.destination).toBe('contact');
  expect(removed.incoming).toBe(2);
  expect(removed.next.graph?.edges.find(edge => edge.id === 'balcony_next')?.to).toBe('contact');
  expect(removed.next.steps).toEqual(base.steps);
  expect(unreachableScreens(removed.next)).toEqual([]);
  expect(graphRemoval(base, 'interests')).toBeNull();
  expect(graphRemoval(base, 'contact')).toBeNull();
  expect(graphRemoval(base, 'received')).toBeNull();
});

it('adds optional capture after an anonymous graph result without moving any question path', () => {
  const original = upgradeToGraph(finder.tree as TemplateTree);
  const next = addGraphResultSignup(original);
  expect(next).not.toBe(original);
  expect(next.submissions).toMatchObject([{ required: false, fields: [expect.any(String)], consents: [expect.any(String)] }]);
  expect(next.graph?.edges.filter(edge => edge.from === 'match').map(edge => edge.kind)).toEqual(['default']);
  expect(graphTrace(next.steps, next.graph!, { n3: 'garden', n6: 'sun' }).indices.map(index => next.steps[index].id))
    .toEqual(['need', 'garden', 'match', next.steps.at(-2)!.id, next.steps.at(-1)!.id]);
  expect(walkNodes(next.steps.at(-2)!.content).filter(node => node.type === 'button' && 'action' in node)
    .map(node => 'action' in node ? node.action : '')).toEqual(['submit', 'skip', 'back']);
  expect(addGraphResultSignup(next)).toBe(next);
});

it('moves a graph quiz signup before and after a result while keeping incoming edge identities', () => {
  const optional = upgradeToGraph(guide.tree as TemplateTree);
  const originalIncoming = optional.graph!.edges.find(edge => edge.to === 'guide')!.id;
  const required = resultAccess(optional, true);
  expect(required.submissions[0].required).toBe(true);
  expect(required.submissions[0].consents).toEqual([]);
  expect(walkNodes(required.steps.find(screen => screen.id === 'signup')!.content)
    .find(node => node.type === 'consent')).toMatchObject({ hidden: true });
  expect(required.steps.find(screen => screen.kind === 'acknowledgement')).toEqual(optional.steps.find(screen => screen.kind === 'acknowledgement'));
  expect(required.graph?.edges.find(edge => edge.id === originalIncoming)?.to).toBe('signup');
  expect(graphTrace(required.steps, required.graph!, { n3: ['grow'] }).indices.map(index => required.steps[index].id))
    .toEqual(['interests', 'signup', 'guide', 'thanks']);
  expect(walkNodes(required.steps.find(screen => screen.id === 'signup')!.content).some(node => node.type === 'button' && 'action' in node && node.action === 'skip')).toBe(false);
  expect(walkNodes(required.steps.find(screen => screen.id === 'signup')!.content).filter(node => node.type === 'button' && 'action' in node && node.action === 'back')
    .map(node => 'label' in node ? node.label : '')).toEqual(['Back']);
  const back = resultAccess(required, false);
  expect(back.submissions[0].required).toBe(false);
  expect(back.graph?.edges.find(edge => edge.id === originalIncoming)?.to).toBe('guide');
  expect(graphTrace(back.steps, back.graph!, { n3: ['grow'] }).indices.map(index => back.steps[index].id))
    .toEqual(['interests', 'guide', 'signup', back.steps.at(-1)!.id]);
  expect(back.submissions[0].fields).toEqual(optional.submissions[0].fields);
  expect(back.submissions[0].consents).toEqual(optional.submissions[0].consents);
  expect(walkNodes(back.steps.find(screen => screen.id === 'signup')!.content)
    .find(node => node.type === 'consent')).toMatchObject({ hidden: false });
  expect(back.steps.find(screen => screen.kind === 'acknowledgement')).toEqual(optional.steps.find(screen => screen.kind === 'acknowledgement'));
  expect(back.graph?.edges.find(edge => edge.to === 'thanks')?.id).toBe(optional.graph?.edges.find(edge => edge.to === 'thanks')?.id);
  expect(unreachableScreens(back)).toEqual([]);
});

it('keeps merchant-written signup copy when changing graph result timing', () => {
  const optional = upgradeToGraph(guide.tree as TemplateTree);
  const customized: TemplateTree = { ...optional, steps: optional.steps.map(screen => screen.id === 'signup'
    ? { ...screen, name: 'Personal notes', content: { type: 'stack', children: [screen.content,
      { type: 'heading', role: 'headline', text: 'Our own heading' }] } } : screen) };
  const required = resultAccess(customized, true);
  expect(required.steps.find(screen => screen.id === 'signup')?.name).toBe('Personal notes');
  expect(walkNodes(required.steps.find(screen => screen.id === 'signup')!.content)
    .some(node => node.type === 'heading' && 'text' in node && node.text === 'Our own heading')).toBe(true);
  const optionalAgain = resultAccess(required, false);
  expect(optionalAgain.steps.find(screen => screen.id === 'signup')?.name).toBe('Personal notes');
  expect(walkNodes(optionalAgain.steps.find(screen => screen.id === 'signup')!.content)
    .some(node => node.type === 'heading' && 'text' in node && node.text === 'Our own heading')).toBe(true);
});

it('preserves merchant-written consent requirements when moving a signup before the result', () => {
  const optional = JSON.parse(JSON.stringify(upgradeToGraph(guide.tree as TemplateTree)), (key, value) =>
    key === 'text' && value === 'Send me email guides and updates. %s' ? 'I agree to the stated use of my details.' : value) as TemplateTree;
  const required = resultAccess(optional, true);
  expect(required.submissions[0].consents).toEqual(optional.submissions[0].consents);
  const consent = walkNodes(required.steps.find(screen => screen.id === 'signup')!.content).find(node => node.type === 'consent');
  expect(consent).toMatchObject({ text: 'I agree to the stated use of my details.' });
  expect(consent && 'hidden' in consent && consent.hidden).not.toBe(true);
});
