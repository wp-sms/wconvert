import { expect, it } from 'vitest';
import type { TemplateTree } from '@renderer/types';
import { graphRemoval, graphRemovalPlan } from '../../resources/admin/src/builder/structure/graphRemoval';
import { graphChangeImpact } from '../../resources/admin/src/builder/structure/graphChangeImpact';
import { freshScreen, walkNodes } from '../../resources/admin/src/builder/structure/journey';
import fixture from '../fixtures/journey-graph-enquiry.json';

const base = fixture as unknown as TemplateTree;

it('removes an orphan even without an outgoing connection, retaining all other work', () => {
  const orphan = freshScreen(base, 'input');
  const tree = { ...base, steps: [...base.steps, orphan] };
  const removed = graphRemoval(tree, orphan.id)!;
  expect(removed.next).toEqual(base);
  expect(removed.destination).toBe(base.graph!.entry);
  expect(removed.incoming).toBe(0);
});

it('requires an explicit continuation for different exits and preserves incoming rules and priority', () => {
  const tree: TemplateTree = { ...base, graph: { ...base.graph!, edges: [
    ...base.graph!.edges.map(edge => edge.id === 'garden_hidden' ? { ...edge, to: 'contact' } : edge),
    { id: 'answer', from: 'interests', to: 'garden', kind: 'answer', when: base.steps[1].when },
  ] } };
  expect(graphRemoval(tree, 'garden')).toBeNull();
  expect(graphRemovalPlan(tree, 'garden').targets.map(item => item.id)).not.toContain('interests');
  expect(graphRemoval(tree, 'garden', 'interests')).toBeNull();
  expect(graphRemoval(tree, 'garden', 'missing')).toBeNull();
  const removed = graphRemoval(tree, 'garden', 'contact')!.next;
  expect(removed.graph!.edges).toEqual(tree.graph!.edges.filter(edge => edge.from !== 'garden')
    .map(edge => edge.to === 'garden' ? { ...edge, to: 'contact' } : edge));
  expect(removed.steps.map(item => item.id)).toContain('indoors');
  expect(graphChangeImpact(tree, removed)).toContain('Indoor details, Balcony details');
});

it('protects external question uses by name but permits deletion of the question and its own branches', () => {
  expect(graphRemovalPlan(base, 'interests').reason).toContain('Indoor details');
  expect(graphRemoval(base, 'interests', 'contact')).toBeNull();
  const tree: TemplateTree = { ...base, graph: { ...base.graph!, edges: [...base.graph!.edges,
    { id: 'garden_answer', from: 'garden', to: 'contact', kind: 'answer', when: { match: 'all', clauses: [
      { question: 'n2', operator: 'is', values: ['large'] },
    ] } },
  ] } };
  expect(graphRemoval(tree, 'garden', 'indoors')).not.toBeNull();
  const dependent = { ...tree, graph: { ...tree.graph!, edges: tree.graph!.edges.map(edge => edge.id === 'garden_answer'
    ? { ...edge, from: 'indoors' } : edge) } };
  expect(graphRemovalPlan(dependent, 'garden').reason).toContain('Indoor details');
  expect(graphRemoval(dependent, 'garden', 'indoors')).toBeNull();
});

it('replaces a first offer with an unconditional screen and removes its now-useless Back button', () => {
  const offer = freshScreen(base, 'content', false);
  const tree: TemplateTree = { ...base, steps: [...base.steps, offer], graph: { ...base.graph!, entry: offer.id,
    edges: [{ id: 'intro', from: offer.id, to: 'interests', kind: 'default' }, ...base.graph!.edges] } };
  expect(graphRemovalPlan(tree, offer.id).targets.map(item => item.id)).not.toContain('garden');
  expect(graphRemoval(tree, offer.id, 'garden')).toBeNull();
  expect(graphRemoval(tree, offer.id)!.next).toEqual(base);
  const contact = graphRemoval(tree, offer.id, 'contact')!.next;
  expect(contact.graph!.entry).toBe('contact');
  expect(walkNodes(contact.steps[0].content).some(node => node.type === 'button' && 'action' in node && node.action === 'back')).toBe(false);
  expect(graphChangeImpact(tree, contact)).toContain('Interests');
});

it('explains protected endings, saves and contact fields', () => {
  expect(graphRemovalPlan(base, 'received').reason).toMatch(/ending/);
  expect(graphRemovalPlan(base, 'contact').reason).toMatch(/contact details/);
  expect(graphRemovalPlan(base, 'missing').reason).toMatch(/no longer/);
});

it('previews a lost required save when rerouting past the capture screen', () => {
  const removed = graphRemoval(base, 'balcony', 'received')!.next;
  expect(graphChangeImpact(base, removed)).toContain('without saving at “One enquiry”');
  expect(graphChangeImpact(base, removed)).toContain('One enquiry');
  expect(removed.submissions).toEqual(base.submissions);
});
