import { expect, it } from 'vitest';
import type { TemplateTree } from '@renderer/types';
import { followupGroups } from '../../resources/admin/src/builder/structure/followupGroups';
import fixture from '../fixtures/journey-graph-enquiry.json';
const tree = fixture as unknown as TemplateTree;
const groupedNames = (value: TemplateTree) => followupGroups(value).map(group => group.screens.map(index => value.steps[index].id));

it('groups the independently checked sequence in route order without rewriting the journey', () => {
  const before = JSON.stringify(tree);
  expect(groupedNames(tree)).toEqual([['garden', 'indoors', 'balcony']]);
  expect(followupGroups(tree)[0].next).toBe('contact');
  expect(JSON.stringify(tree)).toBe(before);
  expect(groupedNames({ ...tree, steps: [...tree.steps].reverse() })).toEqual([['garden', 'indoors', 'balcony']]);
});

it('keeps an outside entry into the middle explicit', () => {
  const branched = { ...tree, graph: { ...tree.graph!, edges: [...tree.graph!.edges,
    { id: 'shortcut', from: 'interests', to: 'indoors', kind: 'answer' as const, when: tree.steps[1].when! }] } };
  expect(groupedNames(branched)).toEqual([['indoors', 'balcony']]);
});

it('does not hide exclusive routes or a different hidden continuation inside a group', () => {
  const skipped = { ...tree, graph: { ...tree.graph!, edges: tree.graph!.edges.map(edge => edge.id === 'garden_hidden' ? { ...edge, to: 'contact' } : edge) } };
  expect(groupedNames(skipped)).toEqual([['indoors', 'balcony']]);
  const branched = { ...tree, graph: { ...tree.graph!, edges: [...tree.graph!.edges,
    { id: 'answer', from: 'indoors', to: 'contact', kind: 'answer' as const, when: tree.steps[1].when! }] } };
  expect(groupedNames(branched)).toEqual([]);
});

it('does not group capture fields or dependent follow-up answers', () => {
  const capture = { ...tree, steps: tree.steps.map(screen => screen.id === 'indoors' ? { ...screen,
    content: { type: 'stack' as const, children: [screen.content, { type: 'field' as const, name: 'name' as const, label: 'Name' }] } } : screen) };
  expect(groupedNames(capture)).toEqual([]);
  const dependent = { ...tree, steps: tree.steps.map(screen => screen.when ? { ...screen,
    when: { ...screen.when, clauses: screen.when.clauses.map(clause => ({ ...clause, question: 'n2' })) } } : screen) };
  expect(groupedNames(dependent)).toEqual([]);
});

it('leaves legacy and simple journeys unchanged', () => {
  expect(followupGroups({ ...tree, graph: undefined })).toEqual([]);
  expect(groupedNames({ ...tree, steps: tree.steps.map(screen => ({ ...screen, when: undefined })) })).toEqual([]);
});
