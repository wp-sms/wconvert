import { expect, it } from 'vitest';
import type { TemplateTree } from '@renderer/types';
import fixture from '../fixtures/journey-graph-enquiry.json';
import { draftEditLabel, draftHistoryLabels, type DraftSnapshot } from '../../resources/admin/src/builder/structure/draftEditLabel';
import { historyOf, remember, undo } from '../../resources/admin/src/builder/structure/history';
const tree = fixture as unknown as TemplateTree;
const snapshot = (value = tree): DraftSnapshot => ({ name: 'Enquiry', config: { template: { tree: value, tokens: {} } } });

it('names the forward action for both Undo and Redo across a coalesced rename', () => {
  const initial = snapshot();
  const rename = (name: string) => snapshot({ ...tree, steps: tree.steps.map(screen => screen.id === 'interests' ? { ...screen, name } : screen) });
  const history = remember(remember(historyOf(initial), rename('Project'), { key: 'name', at: 100 }), rename('Project interests'), { key: 'name', at: 200 });
  expect(history.past).toHaveLength(1);
  expect(draftHistoryLabels(history).undo).toBe('Undo: Rename screen “Interests”');
  expect(draftHistoryLabels(undo(history)).redo).toBe('Redo: Rename screen “Interests”');
  expect(draftHistoryLabels({ ...history, present: JSON.parse(JSON.stringify(history.present)) }).undo).toBe('Undo: Rename screen “Interests”');
});
it('names graph rerouting even when the stored edge order also changes', () => {
  const next = snapshot({ ...tree, graph: { ...tree.graph!, edges: [...tree.graph!.edges].reverse().map(edge => edge.id === 'start' ? { ...edge, to: 'contact' } : edge) } });
  // Only answer-edge order carries priority; default/hidden storage order is irrelevant.
  expect(draftEditLabel(snapshot(), snapshot({ ...tree, graph: { ...tree.graph!, edges: tree.graph!.edges.map(edge => edge.id === 'start' ? { ...edge, to: 'contact' } : edge) } }))).toBe('Change paths from “Interests”');
  expect(draftEditLabel(snapshot(), next)).toBe('Change paths from “Interests”');
});
it('names screen insertion and removal as one operation despite automatic edge changes', () => {
  const removed = snapshot({ ...tree, steps: tree.steps.filter(screen => screen.id !== 'balcony'), graph: { ...tree.graph!, edges: tree.graph!.edges.filter(edge => edge.from !== 'balcony').map(edge => edge.to === 'balcony' ? { ...edge, to: 'contact' } : edge) } });
  expect(draftEditLabel(snapshot(), removed)).toBe('Remove screen “Balcony details”');
  expect(draftEditLabel(removed, snapshot())).toBe('Add screen “Balcony details”');
});
it('keeps destination, display rules, design styles and campaign rename distinct', () => {
  const initial = snapshot();
  expect(draftEditLabel(initial, { ...initial, name: 'New name' })).toBe('Rename campaign');
  expect(draftEditLabel(initial, { ...initial, config: { ...initial.config, destinations: ['one'], capture_mode: 'connected' } })).toBe('Change lead storage or destinations');
  expect(draftEditLabel(initial, { ...initial, config: { ...initial.config, frequency: { stopAfterConversion: false } } })).toBe('Change display rules');
  expect(draftEditLabel(initial, { ...initial, config: { template: { tree, tokens: { background: '#fff' } } } })).toBe('Change design styles');
});
