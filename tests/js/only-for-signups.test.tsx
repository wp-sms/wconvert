import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { Template, TemplateTree } from '@renderer/types';
import { onlyForSignups } from '../../resources/admin/src/builder/structure/journey';
import { upgradeToGraph } from '../../resources/admin/src/builder/structure/graph';
import { SlotFields } from '../../resources/admin/src/builder/SlotFields';
import { slotsOf } from '../../resources/admin/src/builder/panel';
import type { TemplateLabels } from '../../resources/admin/src/templates/api';
import guide from '../../pro/modules/journeys/templates/journey-content-guide.json';
import email from '../../resources/templates/library/journey-email-then-sms.json';

const quiz = (guide as Template).tree;

it('marks only the screens after an optional signup, in a list and in a graph', () => {
  // interests, guide (result), signup (optional), thanks
  expect([0, 1, 2, 3].map(step => onlyForSignups(quiz, step))).toEqual([false, false, false, true]);
  const graph = upgradeToGraph(quiz);
  expect(graph.steps.map((_, step) => onlyForSignups(graph, step))).toEqual(graph.steps.map(screen => screen.id === 'thanks'));
});

it('says nothing where the signup is required, since everyone there signed up', () => {
  const tree = (email as Template).tree as TemplateTree;
  expect(tree.steps.map((_, step) => onlyForSignups(tree, step))).toEqual([false, false, false]);
});

it('tells the merchant who sees the code', () => {
  const tree = structuredClone(quiz) as unknown as { steps: { content: { children: unknown[] } }[] };
  tree.steps[3].content.children.push({ type: 'code', text: 'GUIDE10' });
  const slot = slotsOf(tree as unknown as TemplateTree).find(item => item.type === 'code')!;
  const labels = { keys: { text: 'Code' }, nodeParams: {}, nodeParamValues: {}, roles: {}, fields: {}, nodes: {} } as unknown as TemplateLabels;
  render(<SlotFields slot={slot} labels={labels} signupOnly onValue={vi.fn()} onParam={vi.fn()} onHidden={vi.fn()} />);
  expect(screen.getByText('Only visitors who sign up see this code.')).toBeVisible();
  expect(screen.getByRole('button', { name: 'About Code' })).toBeVisible();
});
