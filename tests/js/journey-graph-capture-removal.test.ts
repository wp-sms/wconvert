import { expect, it } from 'vitest';
import type { TemplateTree, TemplateNode } from '@renderer/types';
import { graphTrace } from '@loader/journey-graph';
import { captureOnScreen, graphCaptureRemovalPlan, removeGraphCapture } from '../../resources/admin/src/builder/structure/graphCaptureRemoval';
import { addGraphResultSignup, referencedJourney, submissionScreen, walkNodes } from '../../resources/admin/src/builder/structure/journey';
import { upgradeToGraph } from '../../resources/admin/src/builder/structure/graph';
import { draftEditLabel } from '../../resources/admin/src/builder/structure/draftEditLabel';
import progressive from '../../resources/templates/library/journey-email-then-sms.json';
import finder from '../../pro/modules/journeys/templates/journey-product-finder.json';

const tree = upgradeToGraph(progressive.tree as TemplateTree);
const optional = tree.submissions.find(sub => !sub.required)!;
const save = tree.steps[submissionScreen(tree, optional.id)];

it('removes an optional progressive capture without changing the earlier acceptance boundary', () => {
  const before = JSON.stringify(tree);
  const removed = removeGraphCapture(tree, optional.id)!.next;
  expect(removed.submissions).toEqual(tree.submissions.filter(sub => sub.required));
  expect(draftEditLabel({ name: 'Signup', config: { template: { tree }, submission_settings: { [optional.id]: { destination_ids: ['sms-provider'] } } } },
    { name: 'Signup', config: { template: { tree: removed }, submission_settings: {} } })).toBe('Remove optional signup');
  expect(removed.steps.map(screen => screen.id)).not.toContain(save.id);
  expect(removed.steps[0]).toEqual(tree.steps[0]);
  expect(removed.graph!.edges.some(edge => edge.to === save.id || edge.from === save.id)).toBe(false);
  expect(graphTrace(removed.steps, removed.graph!, {}).indices.map(index => removed.steps[index].id)).toEqual(removed.steps.map(screen => screen.id));
  expect(JSON.stringify(tree)).toBe(before);
  expect(removeGraphCapture(tree, tree.submissions[0].id)).toBeNull();
});

it('removes split capture screens while preserving an intervening offer and each boundary connection', () => {
  const fieldNodes = walkNodes(save.content).filter(node => node.type === 'field');
  const stripFields = (node: TemplateNode): TemplateNode => {
    const copy = { ...node } as Record<string, unknown>;
    if (Array.isArray(copy.children)) copy.children = (copy.children as TemplateNode[]).filter(node => node.type !== 'field').map(stripFields);
    return copy as unknown as TemplateNode;
  };
  const incoming = tree.graph!.edges.find(edge => edge.to === save.id)!;
  const split: TemplateTree = { ...tree, steps: [...tree.steps.map(screen => screen.id === save.id ? { ...screen, content: stripFields(screen.content) } : screen),
    { id: 'phone', name: 'Your phone', kind: 'input', content: { type: 'stack', children: [...fieldNodes, { type: 'button', action: 'next', label: 'Continue' }] } },
    { id: 'offer', name: 'Offer kept', kind: 'content', content: { type: 'button', action: 'next', label: 'Continue' } },
  ], graph: { ...tree.graph!, edges: [...tree.graph!.edges.map(edge => edge.id === incoming.id ? { ...edge, to: 'phone' } : edge),
    { id: 'phone_offer', from: 'phone', to: 'offer', kind: 'default' }, { id: 'offer_signup', from: 'offer', to: save.id, kind: 'default' }] } };
  expect(captureOnScreen(split, 'phone')?.id).toBe(optional.id);
  expect(graphCaptureRemovalPlan(split, optional.id).screens.map(screen => screen.id)).toEqual(['phone', save.id]);
  const removed = removeGraphCapture(split, optional.id)!.next;
  expect(removed.steps.find(screen => screen.id === 'offer')).toEqual(split.steps.at(-1));
  expect(removed.graph!.edges.find(edge => edge.id === incoming.id)?.to).toBe('offer');
  expect(removed.graph!.edges.find(edge => edge.id === 'offer_signup')?.to).toBe(tree.graph!.edges.find(edge => edge.from === save.id)?.to);
});

it('requires a named exit when the removed signup has several continuations', () => {
  const branched: TemplateTree = { ...tree, steps: [...tree.steps, { id: 'offer', name: 'Offer', kind: 'content', content: { type: 'heading', text: 'Offer' } }],
    graph: { ...tree.graph!, edges: [...tree.graph!.edges, { id: 'extra', from: save.id, to: 'offer', kind: 'answer', when: { match: 'all', clauses: [] } }] } };
  expect(removeGraphCapture(branched, optional.id)).toBeNull();
  expect(removeGraphCapture(branched, optional.id, { [save.id]: tree.graph!.entry })).toBeNull();
  const removed = removeGraphCapture(branched, optional.id, { [save.id]: 'offer' })!.next;
  expect(removed.graph!.edges.find(edge => edge.from === tree.graph!.entry)?.to).toBe('offer');
});

it('protects shared ownership and questions used by surviving rules', () => {
  const shared = { ...tree, submissions: tree.submissions.map(sub => sub.required ? { ...sub, fields: [...sub.fields, ...optional.fields] } : sub) };
  expect(graphCaptureRemovalPlan(shared, optional.id).reason).toMatch(/another signup/);
  const dependent: TemplateTree = { ...tree, steps: tree.steps.map(screen => screen.id === save.id
    ? { ...screen, content: { type: 'stack', children: [screen.content, { id: 'answer', type: 'question', label: 'Choose', answer_type: 'single', options: [{ value: 'yes', label: 'Yes' }], required: false }] } }
    : screen.kind === 'acknowledgement' ? { ...screen, when: { match: 'all', clauses: [{ question: 'answer', operator: 'is', values: ['yes'] }] } } : screen) };
  expect(graphCaptureRemovalPlan(dependent, optional.id).reason).toMatch(/used by rules/);
  expect(removeGraphCapture(dependent, optional.id)).toBeNull();
});

it('returns to an anonymous result and supports adding capture again without duplicating the ending', () => {
  const added = addGraphResultSignup(upgradeToGraph(finder.tree as TemplateTree));
  const removed = removeGraphCapture(added, added.submissions[0].id)!.next;
  expect(removed.submissions).toEqual([]);
  expect(removed.steps.filter(screen => screen.kind === 'acknowledgement')).toHaveLength(1);
  expect(removed.steps.flatMap(screen => walkNodes(screen.content)).some(node => node.type === 'field' || node.type === 'consent'
    || node.type === 'button' && 'submission' in node)).toBe(false);
  const again = addGraphResultSignup(removed);
  expect(again.submissions).toHaveLength(1);
  expect(again.steps.filter(screen => screen.kind === 'acknowledgement')).toHaveLength(1);
  expect(again.graph!.edges.filter(edge => edge.from === 'match')).toHaveLength(1);
  expect(walkNodes(again.steps.find(screen => screen.id === 'match')!.content).some(node => node.type === 'button' && 'label' in node && node.label === 'Optional email updates')).toBe(true);
  expect(referencedJourney(again).submissions).toEqual(again.submissions);
});
