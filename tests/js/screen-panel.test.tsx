import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TemplateTree } from '@renderer/types';
import { ScreenChips, ScreenFact, ScreenThen } from '../../resources/admin/src/builder/ScreenPanel';
import { upgradeToGraph } from '../../resources/admin/src/builder/structure/graph';
import { treeFixture } from './support/journey';
import labels from '../fixtures/template-labels.json';
import type { TemplateLabels } from '../../resources/admin/src/templates/api';

/** The slim screen panel's own sections (ADR 0134): where a screen goes, what it says it is for, what is on it. */
afterEach(cleanup);

const three = (): TemplateTree => treeFixture({ steps: [
  { type: 'stack', children: [{ type: 'heading', text: 'Hello' }, { type: 'button', action: 'next', label: 'Next' }] },
  { type: 'stack', children: [{ type: 'field', name: 'email', required: true }, { type: 'button', action: 'submit', label: 'Join' }] },
  { type: 'stack', children: [{ type: 'heading', text: 'Thanks' }] },
] });

describe('Then →', () => {
  it('says where a screen goes, read-only, on Free', () => {
    render(<ScreenThen tree={three()} step={0} editable={false} onChange={vi.fn()} />);
    expect(screen.getByText('Screen 2')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByText(/Change the order in the screen’s ⋯ menu/)).toBeInTheDocument();
  });

  /** A bar or a one-screen offer goes nowhere next. */
  it('says nothing about next on a one-screen campaign', () => {
    const one = treeFixture({ steps: [{ type: 'stack', children: [{ type: 'heading', text: 'Sale' }, { type: 'button', action: 'link', label: 'Shop', href: '/shop/' }] }] });
    const { container } = render(<ScreenThen tree={one} step={0} editable onChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('says an ending ends the campaign', () => {
    render(<ScreenThen tree={three()} step={2} editable onChange={vi.fn()} />);
    expect(screen.getByText('The campaign ends here')).toBeInTheDocument();
  });

  /** A straight journey choosing its own next screen becomes a graph first, then rewrites that screen's path. */
  it('turns a straight journey into paths when one screen chooses its own next', async () => {
    const onUpgrade = vi.fn();
    render(<ScreenThen tree={three()} step={0} editable onChange={vi.fn()} onUpgrade={onUpgrade} />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Then' }), 's3');
    const next = onUpgrade.mock.calls[0][0] as TemplateTree;
    expect(next.graph?.edges.find(edge => edge.from === 's1' && edge.kind === 'default')?.to).toBe('s3');
  });

  it('rewrites a graph screen’s path in place', async () => {
    const onChange = vi.fn();
    render(<ScreenThen tree={upgradeToGraph(three())} step={0} editable onChange={onChange} />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Then' }), 's3');
    expect((onChange.mock.calls[0][0] as TemplateTree).graph?.edges.find(edge => edge.from === 's1' && edge.kind === 'default')?.to).toBe('s3');
  });

  it('gives a graph screen with no path out its first one', async () => {
    const graphed = upgradeToGraph(three());
    const open = { ...graphed, graph: { ...graphed.graph!, edges: graphed.graph!.edges.filter(edge => edge.from !== 's1') } };
    const onChange = vi.fn();
    render(<ScreenThen tree={open} step={0} editable onChange={onChange} />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Then' }), 's3');
    expect((onChange.mock.calls[0][0] as TemplateTree).graph?.edges.find(edge => edge.from === 's1' && edge.kind === 'default')?.to).toBe('s3');
  });

  it('says a final result ends the campaign rather than offering a choice that does nothing', () => {
    const graphed = upgradeToGraph(treeFixture({ steps: [
      { type: 'stack', children: [{ type: 'question', id: 'q', label: 'Pick', answer_type: 'single', choices: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] }, { type: 'button', action: 'next', label: 'Next' }] },
      { type: 'stack', children: [{ type: 'heading', text: 'Result' }] },
    ] }));
    const tree = { ...graphed, steps: graphed.steps.map((item, at) => at === 1 ? { ...item, kind: 'result' as const } : item) };
    render(<ScreenThen tree={tree} step={1} editable onChange={vi.fn()} />);
    expect(screen.getByText('The campaign ends here')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('sends a question with paths to the question, where its paths live', async () => {
    const tree = upgradeToGraph(three());
    const withAnswer = { ...tree, graph: { ...tree.graph!, edges: [...tree.graph!.edges,
      { id: 'a', from: 's1', to: 's3', kind: 'answer' as const, when: { match: 'all' as const, clauses: [{ question: 'q', operator: 'is' as const, values: ['x'] }] } }] } };
    const onEditPaths = vi.fn();
    render(<ScreenThen tree={withAnswer} step={0} editable onChange={vi.fn()} onEditPaths={onEditPaths} />);
    expect(screen.getByText('Depends on the answer')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Edit paths on the question' }));
    expect(onEditPaths).toHaveBeenCalledOnce();
  });
});

describe('the rest of the screen panel', () => {
  it('states a fact and links to where it is changed', async () => {
    const onAction = vi.fn();
    render(<ScreenFact label="When it opens" value="Everyone · After 8 seconds" action="Display rules" onAction={onAction} />);
    expect(screen.getByText('Everyone · After 8 seconds')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Display rules' }));
    expect(onAction).toHaveBeenCalledOnce();
  });

  it('lists what is on a screen, each opening its element', async () => {
    const onSelect = vi.fn();
    render(<ScreenChips tree={three()} step={1} labels={labels as unknown as TemplateLabels} onSelect={onSelect} />);
    await userEvent.click(screen.getAllByRole('button')[0]);
    expect(onSelect).toHaveBeenCalledWith([1, 'children', 0]);
  });
});
