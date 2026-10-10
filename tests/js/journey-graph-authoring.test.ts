import { afterEach, beforeEach, expect, it } from 'vitest';
import type { TemplateTree } from '@renderer/types';
import { graphTrace } from '@loader/journey-graph';
import { addGraphResultSignup, freshScreen, referencedJourney, replaceAnswer, resultAccess, graphResultAccessIssue, unreachableScreens, usedBy, walkNodes } from '../../resources/admin/src/builder/structure/journey';
import { graphDisplayOrder, graphTargets, insertOnGraphEdge, upgradeToGraph } from '../../resources/admin/src/builder/structure/graph';
import { graphRemoval } from '../../resources/admin/src/builder/structure/graphRemoval';
import fixture from '../fixtures/journey-graph-enquiry.json';
import finder from '../../pro/modules/journeys/templates/journey-product-finder.json';
import guide from '../../pro/modules/journeys/templates/journey-content-guide.json';
import { additionsIn } from '../../resources/admin/src/builder/structure/catalogue';
import { nodesOf } from '../../resources/admin/src/builder/structure/tree';

// Journey authoring is offered only where Pro's `journeys` module registered it (ADR 0116).
beforeEach(() => { window.wconvertAdmin = { exportUrl: '', journeys: true }; });
afterEach(() => { delete window.wconvertAdmin; });

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

/** ADR 0135: a conditional inserted screen falls through along its continuation; it needs no hidden edge. */
it('gives a conditional inserted screen one continuation, which a skip also follows', () => {
  const screen = { ...freshScreen(base, 'input'), when: base.steps.find(step => step.id === 'garden')!.when };
  const next = insertOnGraphEdge(base, 'start', screen);
  expect(next.graph?.edges.filter(edge => edge.from === screen.id).map(edge => [edge.kind, edge.to])).toEqual([
    ['default', 'garden'],
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
  expect(second.graph?.edges.find(edge => edge.from === garden.id && edge.kind === 'default')?.to).toBe(balcony.id);
  expect(second.graph?.edges.some(edge => edge.from === garden.id && edge.kind === 'hidden')).toBe(false);
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

it('moves result access across downstream branches and shared endings without changing priorities', () => {
  const original = upgradeToGraph(guide.tree as TemplateTree);
  const offer = { ...freshScreen(original, 'content'), id: 'offer', name: 'Growing tips' };
  const optional: TemplateTree = referencedJourney({ ...original, steps: [...original.steps, offer], graph: { ...original.graph!, edges: [
    { id: 'growing-route', from: 'signup', to: offer.id, kind: 'answer', when: { match: 'all', clauses: [{ question: 'n3', operator: 'includes_any', values: ['grow'] }] } },
    ...original.graph!.edges,
    { id: 'shared-ending', from: offer.id, to: 'thanks', kind: 'default' },
  ] } });
  const required = resultAccess(optional, true);
  expect(required.submissions[0].required).toBe(true);
  expect(walkNodes(required.steps.find(screen => screen.id === 'guide')!.content).find(node => node.type === 'button' && 'action' in node && node.action === 'next')).toMatchObject({ label: 'Continue' });
  expect(required.graph?.edges.find(edge => edge.id === 'growing-route')).toEqual({ ...optional.graph!.edges[0], from: 'guide' });
  expect(required.graph?.edges.find(edge => edge.id === 'shared-ending')).toEqual(optional.graph!.edges.at(-1));
  expect(graphTrace(required.steps, required.graph!, { n3: ['grow'] }).indices.map(index => required.steps[index].id))
    .toEqual(['interests', 'signup', 'guide', 'offer', 'thanks']);
  expect(graphTrace(required.steps, required.graph!, { n3: ['care'] }).indices.map(index => required.steps[index].id))
    .toEqual(['interests', 'signup', 'guide', 'thanks']);
  const restored = resultAccess(required, false);
  expect(restored.graph).toEqual(optional.graph);
  expect(restored.submissions).toEqual(optional.submissions);
  expect(restored.steps.find(screen => screen.id === 'offer')).toEqual(optional.steps.find(screen => screen.id === 'offer'));
  expect(restored.steps.find(screen => screen.id === 'thanks')).toEqual(optional.steps.find(screen => screen.id === 'thanks'));
});

it('explains independent entrances, conditional signup and result dependencies instead of silently moving them', () => {
  const original = upgradeToGraph(guide.tree as TemplateTree);
  const separate: TemplateTree = { ...original, graph: { ...original.graph!, edges: [
    { id: 'separate', from: 'interests', to: 'signup', kind: 'answer', when: { match: 'all', clauses: [{ question: 'n3', operator: 'includes_any', values: ['care'] }] } },
    ...original.graph!.edges,
  ] } };
  expect(graphResultAccessIssue(separate, true)).toMatchObject({ screenId: 'interests', section: 'paths', message: expect.stringContaining('enters “Optional email updates” separately') });
  expect(resultAccess(separate, true)).toBe(separate);
  const conditional = { ...original, steps: original.steps.map(screen => screen.id === 'signup'
    ? { ...screen, when: { match: 'all' as const, clauses: [{ question: 'n3', operator: 'includes_any' as const, values: ['care'] }] } } : screen) };
  expect(graphResultAccessIssue(conditional, true)).toMatchObject({ screenId: 'signup', section: 'content', message: expect.stringContaining('Show the signup to everyone') });
  expect(resultAccess(conditional, true)).toBe(conditional);
  const required = resultAccess(original, true);
  const dependent: TemplateTree = { ...required, steps: required.steps.map(screen => screen.id === 'signup'
    ? { ...screen, content: { type: 'stack', children: [screen.content, { type: 'question', id: 'on-signup', label: 'Choose', answer_type: 'single', required: true, options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] }] } }
    : screen.id === 'guide' ? { ...screen, results: screen.results!.map((variant, index) => index === 0
      ? { ...variant, when: { match: 'all', clauses: [{ question: 'on-signup', operator: 'is', values: ['yes'] }] } } : variant) } : screen) };
  expect(graphResultAccessIssue(dependent, false)).toMatchObject({ screenId: 'signup', section: 'content', message: expect.stringContaining('uses an answer collected on the signup screen') });
  expect(resultAccess(dependent, false)).toBe(dependent);
});
