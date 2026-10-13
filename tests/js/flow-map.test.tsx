import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TemplateTree } from '@renderer/types';
import { graphTrace } from '@loader/journey-graph';
import { FlowMap } from '../../resources/admin/src/builder/flow/FlowMap';
import { BranchNudge } from '../../pro/modules/journeys/admin/BranchNudge';
import { journeyTraceEdges } from '../../resources/admin/src/builder/structure/journeyTraceEdges';
import type { CampaignIssue } from '../../resources/admin/src/builder/readiness/campaignIssues';
import enquiry from '../fixtures/journey-graph-enquiry.json';
import splitCapture from '../fixtures/journey-graph-split-capture.json';
import coffee from '../fixtures/journey-graph-coffee.json';
import large12 from '../fixtures/journey-graph-large-12.json';

// The page's direction as WordPress gives it: the attribute, and the computed style jsdom does not derive from it.
const setDir = (dir: string) => { document.documentElement.dir = dir; document.documentElement.style.direction = dir; };
afterEach(() => { cleanup(); setDir(''); });
const tree = enquiry as unknown as TemplateTree;
const at = (id: string) => tree.steps.findIndex(screen => screen.id === id);
const props = () => ({ tree, selected: null, onSelect: vi.fn(), onSelectPath: vi.fn() });
const mains = () => [...document.querySelectorAll<HTMLElement>('[data-flow-key]')];

describe('the Flow map (ADR 0142)', () => {
  it('lays the cards out in reading order, with one box for the follow-ups', () => {
    render(<FlowMap {...props()} />);
    const region = screen.getByRole('region', { name: 'Flow map' });
    expect(mains().map(element => element.dataset.flowKey)).toEqual(['interests', 'followups:garden', 'contact', 'received']);
    expect(within(region).getByRole('group', { name: /Follow-ups · Interests: every match is asked/ })).toBeInTheDocument();
    expect(within(region).getByRole('button', { name: 'Question: Interests, 2 lines · Any of these, None of these' })).toBeInTheDocument();
    expect(within(region).getByRole('button', { name: /^Follow-up 2 of 3: Indoor details, only if Indoors/ })).toBeInTheDocument();
  });

  it('draws one arrowhead where lines arrive, whatever their weight', () => {
    render(<FlowMap {...props()} />);
    const targets = new Set(['followups:garden', 'contact', 'received']);
    expect(document.querySelectorAll('.wconvert-flow-arrow')).toHaveLength(targets.size);
  });

  it('is one tab stop that the arrow keys move through, top to bottom', async () => {
    const user = userEvent.setup();
    render(<FlowMap {...props()} />);
    expect(mains().filter(element => element.tabIndex === 0).map(element => element.dataset.flowKey)).toEqual(['interests']);
    await user.tab();
    expect(document.activeElement).toHaveAccessibleName('Try a visitor');
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Question: Interests/ }));
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement?.getAttribute('data-flow-key')).toBe('followups:garden');
    await user.keyboard('{End}');
    expect(document.activeElement?.getAttribute('data-flow-key')).toBe('received');
    await user.keyboard('{Home}');
    expect(document.activeElement?.getAttribute('data-flow-key')).toBe('interests');
  });

  it.each([['ltr', '{ArrowRight}', '{ArrowLeft}'], ['rtl', '{ArrowLeft}', '{ArrowRight}']])('moves across a row with ←/→ in %s, in the reading direction', async (dir, forward, back) => {
    setDir(dir);
    const user = userEvent.setup();
    render(<FlowMap {...props()} tree={large12 as unknown as TemplateTree} />);
    await user.tab();
    await user.tab();
    await user.keyboard('{ArrowDown}');
    // The first branch in reading order: on the left in LTR, on the right in RTL.
    expect(document.activeElement?.getAttribute('data-flow-key')).toBe('garden_01');
    await user.keyboard(forward);
    expect(document.activeElement?.getAttribute('data-flow-key')).toBe('business_01');
    await user.keyboard(forward);
    expect(document.activeElement?.getAttribute('data-flow-key')).toBe('business_01');
    await user.keyboard(back);
    expect(document.activeElement?.getAttribute('data-flow-key')).toBe('garden_01');
  });

  it('tabs from a card to its own buttons, then its lines, in that order', async () => {
    const user = userEvent.setup();
    render(<FlowMap {...props()} onAdd={vi.fn()} />);
    await user.tab();
    await user.tab();
    await user.tab();
    expect(document.activeElement).toHaveTextContent('2 lines · Any of these, None of these');
    // Then its lines' words and "+", across the page in the reading direction.
    const pills = [...document.querySelectorAll<HTMLElement>('.wconvert-flow-pill button')].filter(button => button.tabIndex === 0).map(button => button.getAttribute('aria-label'));
    // The line through the follow-ups first, the one around them last, as they are checked (ADR 0142).
    expect(pills).toEqual(['Any of these: Interests to Follow-ups · Interests. Edit',
      'Add a screen on the line Any of these: Interests to Follow-ups · Interests', 'None of these: Interests to One enquiry. Edit']);
    for (const name of pills) { await user.tab(); expect(document.activeElement?.getAttribute('aria-label')).toBe(name); }
    await user.tab();
    expect(document.activeElement).toHaveAccessibleName('Zoom out');
  });

  it('opens a screen, the control behind “Then →”, a line’s rule, and inserts on a line', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn(), onSelectPath = vi.fn(), onAdd = vi.fn();
    render(<FlowMap {...props()} onSelect={onSelect} onSelectPath={onSelectPath} onAdd={onAdd} />);
    await user.click(screen.getByRole('button', { name: /^Form: One enquiry/ }));
    expect(onSelect).toHaveBeenLastCalledWith(at('contact'));
    await user.click(screen.getByRole('button', { name: 'Then Received' }));
    expect(onSelectPath).toHaveBeenLastCalledWith(at('contact'), 0);
    await user.click(screen.getByRole('button', { name: /^None of these: .*Edit$/ }));
    expect(onSelectPath).toHaveBeenLastCalledWith(at('interests'), 0);
    await user.click(screen.getByRole('button', { name: /^Add a screen on the line Any of these/ }));
    expect(onAdd).toHaveBeenLastCalledWith(at('interests'), 'start');
    await user.click(screen.getByRole('button', { name: /^Follow-up 1 of 3: Garden details/ }));
    expect(onSelect).toHaveBeenLastCalledWith(at('garden'));
  });

  it('offers no “+” where screens cannot be inserted, and none on a line drawn only', () => {
    const { rerender } = render(<FlowMap {...props()} />);
    expect(screen.queryByRole('button', { name: /^Add a screen/ })).toBeNull();
    rerender(<FlowMap {...props()} onAdd={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /^Add a screen on the line None of these/ })).toBeNull();
  });

  it('opens every issue on a screen from its card', async () => {
    const user = userEvent.setup();
    const issue = { key: 'x', said: 'Choose an answer for this line.', screenId: 'contact', blocks: true } as unknown as CampaignIssue;
    const onIssue = vi.fn();
    render(<FlowMap {...props()} issues={[issue]} onIssue={onIssue} />);
    await user.click(screen.getByRole('button', { name: '1 issue on this screen. Show them' }));
    await user.click(await screen.findByRole('button', { name: 'Choose an answer for this line.' }));
    expect(onIssue).toHaveBeenCalledWith(issue);
  });

  it('marks one visitor’s path, says how many follow-ups they were asked, and clears on Escape', async () => {
    const user = userEvent.setup();
    const trace = graphTrace(tree.steps, tree.graph!, { n1: ['garden', 'balcony'], n2: 'small', n4: 'large' });
    const onClearTrace = vi.fn();
    render(<FlowMap {...props()} samplePath={trace.indices} sampleEdges={journeyTraceEdges(tree, trace.decisions)} onClearTrace={onClearTrace} />);
    expect(screen.getByText('This visitor is asked 2 of 3.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Indoor details.*skipped in this trace/ })).toHaveAttribute('data-state', 'off');
    expect(document.querySelector('[data-flow-node="received"]')).toHaveAttribute('data-state', 'on');
    expect(document.querySelector('.wconvert-flow-line[data-state="on"]')).not.toBeNull();
    screen.getByRole('button', { name: /^Question: Interests/ }).focus();
    await user.keyboard('{Escape}');
    expect(onClearTrace).toHaveBeenCalledOnce();
  });

  it('shows Pro’s first-branch nudge on a straight campaign, and no padlock without it', async () => {
    const user = userEvent.setup();
    const straight = splitCapture as unknown as TemplateTree;
    const onBranch = vi.fn();
    const { rerender } = render(<FlowMap {...props()} tree={straight} nudge={<BranchNudge tree={straight} onBranch={onBranch} />} />);
    expect(screen.getByText('Every visitor sees these screens in order.')).toBeInTheDocument();
    // No choice question yet, so there is nothing to send elsewhere.
    expect(screen.getByText('Add a question to send answers to different screens.')).toBeInTheDocument();
    rerender(<FlowMap {...props()} tree={straight} />);
    expect(screen.getByText('Every visitor sees these screens in order.')).toBeInTheDocument();
    expect(screen.queryByText(/comes with|Pro/)).toBeNull();
    const withQuestion: TemplateTree = { ...straight, steps: straight.steps.map((step, index) => index === 0 ? { ...step, content: { type: 'stack', children: [
      { type: 'question', id: 'q', label: 'Which?', answer_type: 'single', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] }] } } : step) } as TemplateTree;
    rerender(<FlowMap {...props()} tree={withQuestion} nudge={<BranchNudge tree={withQuestion} onBranch={onBranch} />} />);
    await user.click(screen.getByRole('button', { name: 'Send some answers to a different screen' }));
    expect(onBranch).toHaveBeenCalledOnce();
  });

  it('labels disconnected follow-ups and keeps them selectable', async () => {
    const onSelect = vi.fn();
    const detached = { ...tree, graph: { ...tree.graph!, edges: tree.graph!.edges.filter(edge => edge.id !== 'start') } };
    render(<FlowMap {...props()} tree={detached} onSelect={onSelect} />);
    expect(screen.getByText('No line reaches these follow-ups')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Follow-up 1 of 3: Garden details/ }));
    expect(onSelect).toHaveBeenCalledWith(at('garden'));
  });

  it('reads right to left in RTL, names isolated', () => {
    setDir('rtl');
    render(<FlowMap {...props()} />);
    const contact = document.querySelector('[data-flow-node="contact"]')!;
    expect(contact).toHaveAttribute('dir', 'rtl');
    expect(contact.querySelector('bdi')).toHaveTextContent('One enquiry');
    // The arrow is mirrored by the page's direction rather than swapped for another glyph (GUIDELINES §15).
    expect(within(contact as HTMLElement).getByRole('button', { name: 'Then Received' }).querySelector('.rtl\\:-scale-x-100')).toHaveTextContent('→');
    expect(document.querySelector('.wconvert-flow-viewport')).toHaveAttribute('dir', 'ltr');
  });

  it('zooms in tenths from its toolbar', async () => {
    const user = userEvent.setup();
    render(<FlowMap {...props()} />);
    const zoom = screen.getByRole('group', { name: 'Zoom' });
    expect(within(zoom).getByLabelText('Zoom level')).toHaveTextContent('100%');
    await user.click(within(zoom).getByRole('button', { name: 'Zoom out' }));
    expect(within(zoom).getByLabelText('Zoom level')).toHaveTextContent('90%');
    await user.click(within(zoom).getByRole('button', { name: 'Zoom in' }));
    expect(within(zoom).getByLabelText('Zoom level')).toHaveTextContent('100%');
  });

  it('tries a visitor in the map: the loader’s own route, marked, and the result it reaches', async () => {
    const user = userEvent.setup();
    const quiz = ((coffee as { template?: { tree: unknown } }).template?.tree ?? coffee) as TemplateTree;
    render(<FlowMap {...props()} tree={quiz} />);
    await user.click(screen.getByRole('button', { name: 'Try a visitor' }));
    const strip = screen.getByRole('group', { name: 'Try a visitor' });
    // Only the questions this visitor reaches are asked.
    expect(within(strip).queryByRole('combobox', { name: 'Do you grind your own beans?' })).toBeNull();
    await user.selectOptions(within(strip).getByRole('combobox', { name: 'How do you make your coffee?' }), 'filter');
    expect(within(strip).getByRole('combobox', { name: 'Do you grind your own beans?' })).toBeInTheDocument();
    expect(within(strip).getByRole('status')).toHaveTextContent(/result: /);
    expect(document.querySelector('[data-flow-node="grind"]')).toHaveAttribute('data-state', 'on');
    expect(document.querySelector('.wconvert-flow-card__sub[data-shown]')).not.toBeNull();
    await user.click(within(strip).getByRole('button', { name: 'Stop' }));
    expect(screen.queryByRole('group', { name: 'Try a visitor' })).toBeNull();
    expect(document.querySelector('[data-state]')).toBeNull();
  });

  it('says how many follow-ups a visitor is asked, and starts again after an edit', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<FlowMap {...props()} />);
    await user.click(screen.getByRole('button', { name: 'Try a visitor' }));
    await user.click(screen.getByRole('checkbox', { name: 'Garden' }));
    expect(screen.getByText('This visitor is asked 1 of 3.')).toBeInTheDocument();
    rerender(<FlowMap {...props()} tree={{ ...tree }} />);
    expect(screen.queryByRole('group', { name: 'Try a visitor' })).toBeNull();
  });
});
