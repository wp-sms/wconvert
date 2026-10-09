import { expect, it } from 'vitest';
import type { TemplateTree } from '@renderer/types';
import fixture from '../fixtures/journey-graph-enquiry.json';
import { graphChangeImpact } from '../../resources/admin/src/builder/structure/graphChangeImpact';
const tree = fixture as unknown as TemplateTree;
const reroute = (base: TemplateTree, id: string, to: string): TemplateTree => ({ ...base,
  graph: { ...base.graph!, edges: base.graph!.edges.map(edge => edge.id === id ? { ...edge, to } : edge) } });

it('names a lost required save even when all screens remain reachable', () => {
  const after = reroute(tree, 'balcony_hidden', 'received');
  expect(graphChangeImpact(tree, after)).toContain('could reach “Received” without saving at “One enquiry”');
  expect(graphChangeImpact(tree, after)).not.toContain('unreachable');
});
it('names unreachable questions separately from a disconnected save', () => {
  const impact = graphChangeImpact(tree, reroute(tree, 'start', 'received'))!;
  expect(impact).toContain('These screens would become unreachable:');
  for (const name of ['Garden details', 'Indoor details', 'One enquiry']) expect(impact).toContain(name);
  expect(impact).toContain('without saving');
});
it('does not re-confirm unchanged topology, rule priority, or an existing bypass', () => {
  expect(graphChangeImpact(tree, { ...tree, graph: { ...tree.graph!, edges: [...tree.graph!.edges].reverse() } })).toBeNull();
  const bypass = reroute(tree, 'balcony_hidden', 'received');
  expect(graphChangeImpact(bypass, reroute(bypass, 'garden_hidden', 'contact'))).toBeNull();
});
it('does not mistake optional capture or an anonymous result for a required gate', () => {
  const optional = { ...tree, submissions: tree.submissions.map(item => ({ ...item, required: false })) };
  expect(graphChangeImpact(optional, reroute(optional, 'balcony_hidden', 'received'))).toBeNull();
  const resultFirst: TemplateTree = { ...tree, steps: tree.steps.map(screen => screen.id === 'interests' ? { ...screen, kind: 'result' } : screen) };
  expect(graphChangeImpact(resultFirst, resultFirst)).toBeNull();
});
it('does not execute a required save on its hidden exit', () => {
  const conditional: TemplateTree = { ...tree, steps: tree.steps.map(screen => screen.id === 'contact'
    ? { ...screen, when: tree.steps.find(item => item.id === 'balcony')!.when } : screen),
    graph: { ...tree.graph!, edges: [...tree.graph!.edges, { id: 'contact_hidden', from: 'contact', to: 'received', kind: 'hidden' }] } };
  expect(graphChangeImpact(tree, conditional)).toContain('without saving');
  expect(graphChangeImpact(conditional, reroute(conditional, 'balcony_hidden', 'received'))).toBeNull();
});
