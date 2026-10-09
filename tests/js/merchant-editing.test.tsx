import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { Template, TemplateTree } from '@renderer/types';
import { graphTrace } from '@loader/journey-graph';
import { moveFollowup, followupInsertionEdge } from '../../resources/admin/src/builder/structure/followupActions';
import { retireAnswerPlan } from '../../resources/admin/src/builder/structure/retireAnswer';
import { ResultSettings } from '../../resources/admin/src/builder/JourneySettings';
import { GraphScreenInsert } from '../../resources/admin/src/builder/GraphScreenInsert';
import { GraphScreenRemove } from '../../resources/admin/src/builder/GraphScreenRemove';
import { Dialog, DialogContent } from '../../resources/admin/src/components/ui/dialog';
import { upgradeToGraph } from '../../resources/admin/src/builder/structure/graph';
import { walkNodes } from '../../resources/admin/src/builder/structure/journey';
import enquiry from '../fixtures/journey-graph-enquiry.json';
import coffee from '../fixtures/journey-graph-coffee.json';
import signup from '../../resources/templates/library/journey-email-only.json';
afterEach(cleanup);
const tree = enquiry as unknown as TemplateTree;
const quiz = coffee.template.tree as unknown as TemplateTree;
const dialog = (child: React.ReactNode) => <Dialog open><DialogContent>{child}</DialogContent></Dialog>;

it('moves shown and skipped follow-up routes together for every interest combination', () => {
  const next = moveFollowup(tree, 'garden', 1);
  expect(next).not.toBe(tree);
  for (let bits = 0; bits < 8; bits++) {
    const interests = ['garden', 'indoors', 'balcony'].filter((_, i) => bits & (1 << i));
    const ids = (value: TemplateTree) => graphTrace(value.steps, value.graph!, { n1: interests }).indices.map(at => value.steps[at].id);
    expect(ids(next)).toEqual(['interests', ...['indoors', 'garden', 'balcony'].filter(id => interests.includes(id)), 'contact', 'received']);
    expect([...ids(next)].sort()).toEqual([...ids(tree)].sort());
  }
  expect(moveFollowup(next, 'garden', -1)).toEqual(tree);
});

it('does not reorder a group with an external entry', () => {
  const custom = { ...tree, graph: { ...tree.graph!, edges: [...tree.graph!.edges, { id: 'outside', from: 'interests', to: 'indoors', kind: 'answer' as const, when: tree.steps[1].when! }] } };
  expect(moveFollowup(custom, 'indoors', 1)).toBe(custom);
});

it('places a follow-up after its existing answer and preserves a custom group order', () => {
  expect(followupInsertionEdge(tree, 'interests', 'n1', 'garden')?.from).toBe('garden');
  const reordered = moveFollowup(tree, 'garden', 1);
  expect(followupInsertionEdge(reordered, 'interests', 'n1', 'garden')?.from).toBe('balcony');
});

it('retires a coffee answer, its exclusive question and result as one coherent edit', () => {
  const plan = retireAnswerPlan(quiz, 'n1', 'filter');
  expect(plan.reason).toBeUndefined();
  expect(plan.next).toBeDefined();
  expect(plan.removed).toContain('Your grinder');
  expect(plan.next!.steps.some(step => step.id === 'grind')).toBe(false);
  expect(plan.next!.submissions).toEqual(quiz.submissions);
  const q = plan.next!.steps.flatMap(step => walkNodes(step.content)).find(node => 'id' in node && node.id === 'n1');
  expect(q).toMatchObject({ options: [{ value: 'espresso' }, { value: 'press' }] });
  expect(quiz.steps.some(step => step.id === 'grind')).toBe(true);
});

it('requires manual review for mixed conditions rather than broadening a result', () => {
  const plan = retireAnswerPlan(quiz, 'n1', 'espresso');
  expect(plan.next).toBeUndefined();
  expect(plan.reason).toMatch(/combine this answer/);
});

it('stages result creation without inventing an answer rule', () => {
  const change = vi.fn();
  render(<ResultSettings tree={quiz} step={quiz.steps.findIndex(step => step.kind === 'result')} onChange={change} />);
  fireEvent.click(screen.getByRole('button', { name: 'Add matching result' }));
  const modal = screen.getByRole('dialog');
  expect(within(modal).getByRole('button', { name: 'Add result' })).toBeDisabled();
  fireEvent.change(within(modal).getByLabelText('Result heading'), { target: { value: 'French press favourite' } });
  fireEvent.change(within(modal).getByLabelText('Question'), { target: { value: 'n1' } });
  expect(within(modal).getByLabelText('Answer')).toHaveValue('');
  expect(change).not.toHaveBeenCalled();
  fireEvent.change(within(modal).getByLabelText('Answer'), { target: { value: 'press' } });
  fireEvent.click(within(modal).getByRole('button', { name: 'Add result' }));
  expect(change).toHaveBeenCalledTimes(1);
  const result = change.mock.calls[0][0].steps.find((step: { kind: string }) => step.kind === 'result').results.at(-2);
  expect(result).toMatchObject({ heading: 'French press favourite', when: { clauses: [{ question: 'n1', values: ['press'] }] } });
});

it('offers a valid question location without silently changing an explicit path', () => {
  const value = upgradeToGraph(signup.tree as unknown as TemplateTree), change = vi.fn();
  const source = value.graph!.entry;
  const edge = value.graph!.edges.find(item => item.from === source)!;
  render(dialog(<GraphScreenInsert tree={value} source={source} kind="input" initialLocation={`edge:${edge.id}`} onInsert={change} onCancel={() => {}} />));
  fireEvent.click(screen.getByRole('button', { name: /Ask a question/ }));
  expect(screen.getByRole('button', { name: 'Add screen here' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: `Add before ${value.steps.find(item => item.id === source)!.name}` }));
  fireEvent.change(screen.getByLabelText('Answer type'), { target: { value: 'text' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add screen here' }));
  expect(change.mock.calls[0][0]).toBe('entry');
  expect(change.mock.calls[0][6]).toBe('text');
});

it('summarizes grouped deletion before exposing alternate continuations', () => {
  render(dialog(<GraphScreenRemove tree={tree} screenId="garden" onRemove={() => {}} onCancel={() => {}} />));
  expect(screen.getByLabelText('After removing')).toHaveTextContent('remaining matching follow-ups');
  expect(screen.queryByRole('combobox')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Change continuation' }));
  expect(screen.getByRole('combobox')).toHaveValue('indoors');
});

it('lists phone-capable providers for optional SMS instead of treating sms as a provider channel', async () => {
  const { SubmissionSettings } = await import('../../resources/admin/src/builder/SubmissionSettings');
  const { default: source } = await import('../../resources/templates/library/journey-email-then-sms.json');
  const types = [{ id: 'wsms', label: 'WP SMS', icon: 'phone', tier: 'free' as const, requires: 'wp-sms', requires_label: 'WP SMS', availability: 'unavailable' as const, needs_connection: false, settings_schema: {}, requirements: { audience_channels: ['email', 'phone'], capture_any_of: ['email', 'phone'], fields: [], mapped_fields: {}, settings: {} } }];
  const change = vi.fn();
  const { ready } = await import('../../resources/admin/src/shell/loadable');
  render(<SubmissionSettings template={source as unknown as Template} primaryChannel="email" config={{}} available={ready([])} types={types} onChange={change} onSaved={() => {}} onRefresh={() => {}} />);
  expect(screen.getByRole('heading', { name: 'Optional SMS signup' })).toBeVisible();
  expect(screen.getByRole('button', { name: /WP SMS/ })).toHaveAccessibleDescription('Needs WP SMS on this site.');
  expect(screen.queryByText('No destination providers are available on this site.')).toBeNull();
  expect(change).not.toHaveBeenCalled();
});

it('keeps a shared question when retiring only one of its incoming answer paths', () => {
  const shared = { ...quiz, graph: { ...quiz.graph!, edges: quiz.graph!.edges.map(edge => edge.from === 'taste' && edge.kind === 'default' ? { ...edge, to: 'grind' } : edge) } };
  const plan = retireAnswerPlan(shared, 'n1', 'filter');
  expect(plan.next?.steps.some(step => step.id === 'grind')).toBe(true);
  expect(plan.removed).not.toContain('Your grinder');
});

it('does not retire an exclusive path that owns contact collection', () => {
  const protectedTree = { ...quiz, steps: quiz.steps.map(step => step.id === 'grind' ? { ...step, content: { type: 'field' as const, id: 'protected-email', field: 'email', label: 'Email' } } : step) } as TemplateTree;
  const plan = retireAnswerPlan(protectedTree, 'n1', 'filter');
  expect(plan.next).toBeUndefined();
  expect(plan.reason).toMatch(/contact details/);
});
