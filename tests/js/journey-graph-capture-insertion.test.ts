import { expect, it } from 'vitest';
import type { TemplateTree } from '@renderer/types';
import { graphTrace } from '@loader/journey-graph';
import { addGraphCapture, graphCaptureInsertion } from '../../resources/admin/src/builder/structure/graphCaptureInsertion';
import { upgradeToGraph } from '../../resources/admin/src/builder/structure/graph';
import { walkNodes } from '../../resources/admin/src/builder/structure/journey';
import { removeGraphCapture } from '../../resources/admin/src/builder/structure/graphCaptureRemoval';
import source from '../../resources/templates/library/journey-email-only.json';
const tree = upgradeToGraph(source.tree as TemplateTree);
const location = `edge:${tree.graph!.edges[0].id}`;

it('adds separate optional SMS ownership after primary acceptance and removes it without altering the original save', () => {
  const next = addGraphCapture(tree, 'email', location);
  const secondary = next.submissions[1];
  expect(next.submissions[0]).toEqual(tree.submissions[0]);
  expect(secondary).toMatchObject({ id: 'sms-signup', required: false, fields: [expect.any(String)], consents: [expect.any(String)] });
  const nodes = walkNodes(next.steps.at(-1)!.content);
  expect(nodes.find(node => node.type === 'field')).toMatchObject({ name: 'phone', required: true });
  expect(nodes.filter(node => node.type === 'button' && 'submission' in node)).toMatchObject([
    { action: 'submit', submission: secondary.id }, { action: 'skip', submission: secondary.id },
  ]);
  expect(graphTrace(next.steps, next.graph!, {}).indices.map(index => next.steps[index].id))
    .toEqual([tree.graph!.entry, next.steps.at(-1)!.id, tree.steps.at(-1)!.id]);
  expect(removeGraphCapture(next, secondary.id)!.next).toEqual(tree);
  expect(addGraphCapture(next, 'email', location)).toBe(next);
});

it('offers email for SMS campaigns and refuses non-list or duplicate-channel configurations', () => {
  const phone: TemplateTree = { ...tree, steps: tree.steps.map(screen => ({ ...screen, content: { type: 'stack', children: walkNodes(screen.content)
    .filter(node => node.type !== 'stack').map(node => node.type === 'field' ? { ...node, name: 'phone' } : node) } })) };
  const next = addGraphCapture(phone, 'phone', location);
  expect(addGraphCapture(phone, 'sms', location)).toEqual(next);
  expect(walkNodes(next.steps.at(-1)!.content).find(node => node.type === 'field')).toMatchObject({ name: 'email' });
  expect(graphCaptureInsertion(tree, null).reason).toMatch(/list campaigns/);
  expect(addGraphCapture(tree, null, location)).toBe(tree);
  expect(graphCaptureInsertion(tree, 'sms').reason).toMatch(/already collects/);
});

it('excludes an entry path, a hidden primary exit and a merge reached without acceptance', () => {
  const invalid: TemplateTree = { ...tree, steps: [{ id: 'intro', name: 'Intro', kind: 'content', content: { type: 'button', action: 'next', label: 'Continue' } },
    ...tree.steps, { id: 'offer', name: 'Offer', kind: 'content', content: { type: 'button', action: 'next', label: 'Continue' } }],
    graph: { entry: 'intro', edges: [
      { id: 'before', from: 'intro', to: tree.graph!.entry, kind: 'default' },
      { ...tree.graph!.edges[0], to: 'offer' },
      { id: 'hidden', from: tree.graph!.entry, to: 'offer', kind: 'hidden' },
      { id: 'merged', from: 'offer', to: tree.steps.at(-1)!.id, kind: 'default' },
    ] } };
  expect(graphCaptureInsertion(invalid, 'email').locations.map(item => item.id)).toEqual([location]);
  expect(addGraphCapture(invalid, 'email', 'entry')).toBe(invalid);
  expect(addGraphCapture(invalid, 'email', 'edge:hidden')).toBe(invalid);
  expect(addGraphCapture(invalid, 'email', 'edge:merged')).toBe(invalid);
  const next = addGraphCapture(invalid, 'email', location);
  expect(next.graph!.edges.find(edge => edge.id === 'hidden')).toEqual(invalid.graph!.edges.find(edge => edge.id === 'hidden'));
});

it('preserves priority and targets on every unchosen connection', () => {
  const branched: TemplateTree = { ...tree, steps: [...tree.steps, { id: 'offer', name: 'Offer', kind: 'content', content: { type: 'heading', text: 'Offer' } }],
    graph: { ...tree.graph!, edges: [{ id: 'chosen', from: tree.graph!.entry, to: 'offer', kind: 'answer', when: { match: 'all', clauses: [] } }, ...tree.graph!.edges] } };
  const next = addGraphCapture(branched, 'email', 'edge:chosen');
  expect(next.graph!.edges[0]).toEqual({ ...branched.graph!.edges[0], to: next.steps.at(-1)!.id });
  expect(next.graph!.edges[1]).toEqual(branched.graph!.edges[1]);
  expect(next.graph!.edges.at(-1)?.to).toBe('offer');
});
