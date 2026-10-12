import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TemplateTree } from '@renderer/types';
import { ScreenAnswers, ScreenChips, ScreenThen } from '../../resources/admin/src/builder/ScreenPanel';
import enquiry from '../fixtures/journey-graph-enquiry.json';
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
    const onEditPaths = vi.fn(), onEditLine = vi.fn();
    render(<ScreenThen tree={withAnswer} step={0} editable onChange={vi.fn()} onEditPaths={onEditPaths} onEditLine={onEditLine} />);
    expect(screen.getByText('First match wins, top to bottom')).toBeInTheDocument();
    // Each line as the map draws it, in the order it is checked, "All other answers" last (ADR 0142).
    const lines = [...document.querySelectorAll('.wconvert-screen-lines li')].map(item => item.textContent);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('All other answers → Screen 2');
    await userEvent.click(screen.getByRole('button', { name: /All other answers/ }));
    expect(onEditLine).toHaveBeenCalledWith(1);
    await userEvent.click(screen.getByRole('button', { name: 'Edit lines' }));
    expect(onEditPaths).toHaveBeenCalledOnce();
  });
});

describe('the rest of the screen panel', () => {
  // A fact row is the panel grammar's FactRow, tested in panel-grammar.test.tsx (ADR 0136).

  it('lists what is on a screen, each opening its element', async () => {
    const onSelect = vi.fn();
    render(<ScreenChips tree={three()} step={1} labels={labels as unknown as TemplateLabels} onSelect={onSelect} />);
    await userEvent.click(screen.getAllByRole('button')[0]);
    expect(onSelect).toHaveBeenCalledWith([1, 'children', 0]);
  });
});

/** ADR 0135: moving a screen's default drops a skip edge that only copied it, so the screen keeps falling through. */
it('drops a copied skip edge when the screen’s next screen changes, and keeps a real override', async () => {
  const graphed = upgradeToGraph(treeFixture({ steps: [
    { type: 'stack', children: [{ type: 'heading', text: 'One' }] },
    { type: 'stack', children: [{ type: 'heading', text: 'Two' }] },
    { type: 'stack', children: [{ type: 'heading', text: 'Three' }] },
    { type: 'stack', children: [{ type: 'heading', text: 'Four' }] },
  ] }));
  const when = { match: 'all' as const, clauses: [{ question: 'q', operator: 'is' as const, values: ['x'] }] };
  const withSkip = (to: string) => ({ ...graphed, steps: graphed.steps.map((item, at) => at === 1 ? { ...item, when } : item),
    graph: { ...graphed.graph!, edges: [...graphed.graph!.edges, { id: 'skip', from: 's2', to, kind: 'hidden' as const }] } });
  const onChange = vi.fn();
  const { unmount } = render(<ScreenThen tree={withSkip('s3')} step={1} editable onChange={onChange} />);
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Then' }), 's4');
  expect((onChange.mock.calls[0][0] as TemplateTree).graph?.edges.some(edge => edge.id === 'skip')).toBe(false);
  unmount();
  onChange.mockClear();
  // A real override (to somewhere other than the old default) is the merchant's choice and stays.
  render(<ScreenThen tree={withSkip('s4')} step={1} editable onChange={onChange} />);
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Then' }), 's4');
  expect((onChange.mock.calls[0][0] as TemplateTree).graph?.edges.find(edge => edge.id === 'skip')?.to).toBe('s4');
});

/** The panel shows each answer in the color it has on the Flow map, with the follow-ups it opens (ADR 0142). */
describe('a question screen’s answers', () => {
  const tree = enquiry as unknown as TemplateTree;
  const at = tree.steps.findIndex(item => item.id === 'interests');

  it('dots each answer in its map color and opens its follow-up', async () => {
    const onSelect = vi.fn();
    render(<ScreenAnswers tree={tree} step={at} onSelect={onSelect} />);
    expect(screen.getByText('Answers · choose several')).toBeInTheDocument();
    const dots = [...document.querySelectorAll('.wconvert-screen-answers .wconvert-flow-dot')].map(dot => dot.getAttribute('data-color'));
    expect(dots).toEqual(['1', '2', '3']);
    await userEvent.click(screen.getByRole('button', { name: 'Follow-up: Garden details' }));
    expect(onSelect).toHaveBeenCalledWith(tree.steps.findIndex(item => item.id === 'garden'));
  });

  it('offers “+ Follow-up” for an answer that has none', async () => {
    const onFollowup = vi.fn();
    const bare: TemplateTree = { ...tree, steps: tree.steps.map(item => item.id === 'balcony' ? { ...item, when: undefined } : item) };
    render(<ScreenAnswers tree={bare} step={at} onSelect={vi.fn()} onFollowup={onFollowup} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add a follow-up for “Balcony”' }));
    expect(onFollowup).toHaveBeenCalledWith('n1', 'balcony');
    expect(document.querySelectorAll('.wconvert-screen-answers .wconvert-flow-dot')[2]).not.toHaveAttribute('data-color');
  });
});
