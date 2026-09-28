import { expect, it } from 'vitest';
import type { TemplateTree } from '@renderer/types';
import fixture from '../fixtures/journey-graph-branch-groups.json';
import { questionPath } from '../../resources/admin/src/builder/structure/questionBudget';
import { additionsIn } from '../../resources/admin/src/builder/structure/catalogue';
import { journeyReadinessIssues } from '../../resources/admin/src/builder/structure/journeyReadiness';
const base = fixture as unknown as TemplateTree;
const extra = (count: number): TemplateTree => ({ ...base, steps: base.steps.map(screen => screen.id === 'home_garden'
  ? { ...screen, content: { type: 'stack', children: [screen.content, ...Array.from({ length: count }, (_, i) => ({ type: 'question', id: `n${100 + i}`, label: `Extra ${i + 1}`, answer_type: 'text' as const, required: false }))] } } : screen) });
const canAdd = (tree: TemplateTree, id: string) => additionsIn(tree, { parent: [tree.steps.findIndex(screen => screen.id === id)], key: 'children', index: 0 }, 'submit').find(item => item.type === 'question')?.refused;

it('budgets exclusive routes independently, including when storage is reversed', () => {
  expect(questionPath(base)?.count).toBe(6);
  expect(journeyReadinessIssues(base)).toEqual([]);
  expect(canAdd(base, 'home_garden')).toBeNull();
  expect(questionPath({ ...base, steps: [...base.steps].reverse() })?.count).toBe(6);
});

it('allows ten per route and refuses additions only where they can exceed that bound', () => {
  const ten = extra(4);
  expect(questionPath(ten)?.count).toBe(10);
  expect(journeyReadinessIssues(ten)).toEqual([]);
  expect(canAdd(ten, 'home_garden')).toContain('more than ten questions');
  expect(canAdd(ten, 'scope')).toContain('more than ten questions');
  expect(canAdd(ten, 'business_office')).toBeNull();
  const issue = journeyReadinessIssues(extra(5)).find(item => item.key === 'question-path-limit');
  expect(issue?.said).toContain('11 questions; the limit is ten');
  expect(issue?.said).toContain('Garden landscaping details');
  expect(issue?.repair).toEqual({ screenId: 'home_irrigation', section: 'content', focus: 'questions' });
});

it('does not count a hidden screen on the exit that skips it', () => {
  const tree: TemplateTree = { ...base, steps: base.steps.slice(0, 3).map((screen, i) => ({ ...screen, id: `s${i}`, content: { type: 'stack', children: Array.from({ length: i ? 8 : 1 }, (_, j) => ({ type: 'question', id: `q${i}_${j}` })) } })),
    graph: { entry: 's0', edges: [{ id: 'entry', from: 's0', to: 's1', kind: 'default' }, { id: 'skip', from: 's1', to: 's2', kind: 'hidden' }] } };
  expect(questionPath(tree)?.count).toBe(9);
  expect(questionPath({ ...tree, graph: { ...tree.graph!, edges: [...tree.graph!.edges, { id: 'cycle', from: 's2', to: 's0', kind: 'default' }] } })).toBeNull();
});
