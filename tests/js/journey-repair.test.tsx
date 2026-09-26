import { useState } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import type { QuestionCondition, QuestionNode, TemplateTree } from '@renderer/types';
import { ConditionSettings, ScreenConditionSettings } from '../../resources/admin/src/builder/JourneySettings';
import { GraphRouteSettings } from '../../resources/admin/src/builder/GraphRouteSettings';
import { journeyReadinessIssues } from '../../resources/admin/src/builder/structure/journeyReadiness';
import fixture from '../fixtures/journey-graph-enquiry.json';

afterEach(cleanup);
const question: QuestionNode & { id: string } = { type: 'question', id: 'q1', label: 'Your interests', answer_type: 'multi', required: false,
  options: [{ value: 'garden', label: 'Garden' }, { value: 'balcony', label: 'Balcony' }] };
function Rule({ sources = [question], initial }: { sources?: (QuestionNode & { id: string })[]; initial: QuestionCondition }) {
  const [value, setValue] = useState(initial);
  return <><ConditionSettings required value={value} sources={sources} onChange={next => next && setValue(next)} />
    <output data-testid="condition">{JSON.stringify(value)}</output></>;
}

it('shows an unavailable question explicitly until the merchant chooses its replacement', async () => {
  const user = userEvent.setup();
  render(<Rule initial={{ match: 'all', clauses: [{ question: 'deleted', operator: 'is', values: ['old'] }] }} />);
  expect(screen.getByRole('combobox', { name: 'Question' })).toHaveValue('deleted');
  expect(screen.getByRole('option', { name: /Question unavailable/ })).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'Answer' })).toBeDisabled();
  await user.selectOptions(screen.getByRole('combobox', { name: 'Question' }), 'q1');
  expect(JSON.parse(screen.getByTestId('condition').textContent!).clauses[0]).toEqual({ question: 'q1', operator: 'includes_any', values: ['garden'] });
  expect(screen.getByRole('checkbox', { name: 'Garden' })).toBeChecked();
});

it('allows removal of obsolete choices without hiding their presence', async () => {
  const user = userEvent.setup();
  render(<Rule initial={{ match: 'all', clauses: [{ question: 'q1', operator: 'includes_any', values: ['garden', 'old'] }] }} />);
  expect(screen.getByText(/contains an answer that is no longer available/)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Remove unavailable answers' }));
  expect(JSON.parse(screen.getByTestId('condition').textContent!).clauses[0].values).toEqual(['garden']);
});

it('can clear an invalid required rule with no sources without crashing or making it match everyone', async () => {
  const user = userEvent.setup();
  render(<Rule sources={[]} initial={{ match: 'all', clauses: [{ question: 'deleted', operator: 'is', values: ['old'] }] }} />);
  expect(screen.getByRole('button', { name: 'Add another condition' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Remove' }));
  expect(JSON.parse(screen.getByTestId('condition').textContent!).clauses).toEqual([]);
  expect(screen.getByRole('button', { name: 'Add condition' })).toBeDisabled();
});

it('repairs both a missing default and hidden exit through controls without dragging', async () => {
  const user = userEvent.setup();
  const base = fixture as unknown as TemplateTree;
  function Routes() {
    const [tree, setTree] = useState<TemplateTree>({ ...base, graph: { ...base.graph!, edges: base.graph!.edges.filter(edge => edge.from !== 'garden') } });
    return <><GraphRouteSettings tree={tree} step={tree.steps.findIndex(screen => screen.id === 'garden')} onChange={setTree} onInsert={() => {}} />
      <output data-testid="tree">{JSON.stringify(tree)}</output></>;
  }
  render(<Routes />);
  expect(screen.queryByText('Journey ends here')).not.toBeInTheDocument();
  await user.selectOptions(screen.getByRole('combobox', { name: 'Go to' }), 'indoors');
  await user.selectOptions(screen.getByRole('combobox', { name: 'Continue at' }), 'contact');
  const tree = JSON.parse(screen.getByTestId('tree').textContent!) as TemplateTree;
  expect(tree.graph?.edges.filter(edge => edge.from === 'garden')).toEqual([
    expect.objectContaining({ kind: 'default', to: 'indoors' }), expect.objectContaining({ kind: 'hidden', to: 'contact' }),
  ]);
  expect(journeyReadinessIssues(tree)).toEqual([]);
});

it('preserves a hidden continuation while repairing visibility without a default connection', async () => {
  const user = userEvent.setup();
  const base = fixture as unknown as TemplateTree;
  function Visibility() {
    const [tree, setTree] = useState<TemplateTree>({ ...base, graph: { ...base.graph!, edges: base.graph!.edges.filter(edge => edge.id !== 'garden_next') } });
    return <><ScreenConditionSettings tree={tree} step={tree.steps.findIndex(item => item.id === 'garden')} onChange={setTree} onSelect={() => {}} />
      <output data-testid="tree">{JSON.stringify(tree)}</output></>;
  }
  render(<Visibility />);
  await user.click(screen.getByRole('checkbox', { name: 'Balcony' }));
  const tree = JSON.parse(screen.getByTestId('tree').textContent!) as TemplateTree;
  expect(tree.graph?.edges.find(edge => edge.id === 'garden_hidden')).toEqual(base.graph?.edges.find(edge => edge.id === 'garden_hidden'));
  expect(tree.graph?.edges.some(edge => edge.id === 'garden_next')).toBe(false);
});

it('lets a merchant add a condition to an existing answer path whose condition is missing', async () => {
  const user = userEvent.setup();
  const base = fixture as unknown as TemplateTree;
  function Routes() {
    const [tree, setTree] = useState<TemplateTree>({ ...base, graph: { ...base.graph!, edges: [...base.graph!.edges,
      { id: 'broken', from: 'interests', to: 'balcony', kind: 'answer' },
    ] } });
    return <><GraphRouteSettings tree={tree} step={tree.steps.findIndex(item => item.id === 'interests')} onChange={setTree} onInsert={() => {}} />
      <output data-testid="tree">{JSON.stringify(tree)}</output></>;
  }
  render(<Routes />);
  await user.click(screen.getByRole('button', { name: 'Add condition' }));
  const tree = JSON.parse(screen.getByTestId('tree').textContent!) as TemplateTree;
  expect(tree.graph?.edges.find(edge => edge.id === 'broken')?.when?.clauses).toEqual([
    { question: 'n1', operator: 'includes_any', values: ['garden'] },
  ]);
});

it('reviews a save bypass without disconnecting screens and returns focus after cancellation', async () => {
  const user = userEvent.setup();
  const base = fixture as unknown as TemplateTree;
  function Routes() {
    const [tree, setTree] = useState(base);
    return <><GraphRouteSettings tree={tree} step={tree.steps.findIndex(item => item.id === 'balcony')} onChange={setTree} onInsert={() => {}} />
      <output data-testid="tree">{JSON.stringify(tree)}</output></>;
  }
  render(<Routes />);
  const hiddenDestination = screen.getByRole('combobox', { name: 'Continue at' });
  await user.selectOptions(hiddenDestination, 'received');
  expect(screen.getByRole('alertdialog')).toHaveTextContent('could reach “Received” without saving at “One enquiry”');
  expect(JSON.parse(screen.getByTestId('tree').textContent!).graph.edges.find((edge: { id: string }) => edge.id === 'balcony_hidden').to).toBe('contact');
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(hiddenDestination).toHaveFocus();
  expect(hiddenDestination).toHaveValue('contact');
  await user.selectOptions(hiddenDestination, 'received');
  await user.click(screen.getByRole('button', { name: 'Apply path change' }));
  expect(hiddenDestination).toHaveValue('received');
});


it('focuses the hidden continuation when that map connection is selected', () => {
  const tree = fixture as unknown as TemplateTree;
  render(<GraphRouteSettings tree={tree} step={tree.steps.findIndex(screen => screen.id === 'garden')} focusPath="hidden" onChange={() => {}} onInsert={() => {}} />);
  expect(screen.getByRole('combobox', { name: 'Continue at' })).toHaveFocus();
});

it('can create the missing condition on an imported matching result', async () => {
  const user = userEvent.setup();
  const update = vi.fn();
  render(<ConditionSettings required sources={[question]} onChange={update} />);
  await user.click(screen.getByRole('button', { name: 'Add condition' }));
  expect(update).toHaveBeenCalledWith({ match: 'all', clauses: [{ question: 'q1', operator: 'includes_any', values: ['garden'] }] });
});
