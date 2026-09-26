import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { historyOf, remember, undo, redo } from '../../resources/admin/src/builder/structure/history';
import { draftHistoryLabels } from '../../resources/admin/src/builder/structure/draftEditLabel';
import { JourneyEditor } from '../../resources/admin/src/builder/JourneyEditor';
import { Fullscreen } from '../../resources/admin/src/builder/Fullscreen';
import type { QuestionCondition, QuestionNode, TemplateTree } from '@renderer/types';
import { ConditionSettings } from '../../resources/admin/src/builder/JourneySettings';
import { addGraphResultSignup, movedScreen, removedScreen, referencedJourney, replaceAnswer, walkNodes } from '../../resources/admin/src/builder/structure/journey';
import { upgradeToGraph } from '../../resources/admin/src/builder/structure/graph';
import progressive from '../../resources/templates/library/journey-email-then-sms.json';
import source from '../../resources/templates/library/journey-email-only.json';
import rules from '../fixtures/journey-rules.json';
import service from '../../pro/modules/journeys/templates/journey-service-enquiry.json';
import finder from '../../pro/modules/journeys/templates/journey-product-finder.json';
import graphFixture from '../fixtures/journey-graph-enquiry.json';

vi.mock('../../resources/admin/src/builder/Preview', () => ({ Preview: () => <div /> }));
vi.mock('../../resources/admin/src/builder/JourneyMap', () => ({ JourneyMap: ({ onConnect, onReconnect, onSelect }: {
  onConnect(source: string, target: string): void; onReconnect(edge: string, target: string): void; onSelect(index: number): void;
}) => <div aria-label="Journey map">
  <button onClick={() => onSelect(0)}>Select first screen</button>
  <button onClick={() => onConnect('interests', 'contact')}>Draw test branch</button>
  <button onClick={() => onReconnect('start', 'contact')}>Reconnect test route</button>
  <button onClick={() => onReconnect('balcony_hidden', 'received')}>Bypass test save</button>
</div> }));
beforeEach(() => vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('focuses the existing workspace without remounting it and closes nested UI before exiting', async () => {
  const user = userEvent.setup();
  const { unmount } = render(<JourneyEditor embedded tree={source.tree as TemplateTree} step={0} onChange={() => {}} onSelect={() => {}} />);
  const map = await screen.findByLabelText('Journey map');
  await user.click(screen.getByRole('button', { name: 'Focus journey' }));
  expect(document.body).toHaveClass('wconvert-journey-focus');
  expect(screen.getByLabelText('Journey map')).toBe(map);
  await user.click(screen.getByRole('button', { name: 'Add screen' }));
  await user.keyboard('{Escape}');
  expect(document.body).toHaveClass('wconvert-journey-focus');
  await user.click(screen.getByRole('button', { name: 'Test journey' }));
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog', { name: 'Test journey' })).not.toBeInTheDocument();
  expect(document.body).toHaveClass('wconvert-journey-focus');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Test journey' })).toHaveFocus());
  await user.keyboard('{Escape}');
  expect(document.body).not.toHaveClass('wconvert-journey-focus');
  expect(screen.getByRole('button', { name: 'Focus journey' })).toHaveFocus();
  expect(screen.getByLabelText('Journey map')).toBe(map);
  await user.click(screen.getByRole('button', { name: 'Focus journey' }));
  unmount();
  expect(document.body).not.toHaveClass('wconvert-journey-focus');
});

it('leaves the saved Full width preference intact when exiting journey focus', async () => {
  const user = userEvent.setup();
  render(<><Fullscreen /><JourneyEditor embedded tree={source.tree as TemplateTree} step={0} onChange={() => {}} onSelect={() => {}} /></>);
  await user.click(screen.getByRole('button', { name: 'Full width' }));
  const remembered = localStorage.getItem('wconvert:fullscreen');
  await user.click(screen.getByRole('button', { name: 'Focus journey' }));
  await user.keyboard('{Escape}');
  expect(document.body).not.toHaveClass('wconvert-journey-focus');
  expect(document.body).toHaveClass('wconvert-fullscreen');
  expect(localStorage.getItem('wconvert:fullscreen')).toBe(remembered);
  await user.click(screen.getByRole('button', { name: 'Show the menu' }));
});
function Editor({ initial = source.tree as TemplateTree }: { initial?: TemplateTree }) {
  const [tree, setTree] = useState(initial);
  const [step, setStep] = useState(0);
  return <><JourneyEditor tree={tree} step={step} primaryChannel="email" onChange={setTree} onSelect={setStep} />
    <output data-testid="draft">{JSON.stringify(tree)}</output></>;
}
function draft(): TemplateTree { return JSON.parse(screen.getByTestId('draft').textContent!); }

it('lets an ending selection add a question at an explicit location and restores focus on cancel', async () => {
  const user = userEvent.setup();
  const initial = graphFixture as unknown as TemplateTree;
  function EndingEditor() {
    const [tree, setTree] = useState(initial);
    const [step, setStep] = useState(initial.steps.findIndex(item => item.id === 'received'));
    return <><JourneyEditor embedded tree={tree} step={step} onChange={setTree} onSelect={setStep} />
      <output data-testid="draft">{JSON.stringify(tree)}</output></>;
  }
  render(<EndingEditor />);
  await user.click(screen.getByRole('button', { name: 'Focus journey' }));
  await user.click(screen.getByRole('button', { name: 'Add screen' }));
  await user.click(screen.getByRole('menuitem', { name: 'Add question screen' }));
  const dialog = screen.getByRole('dialog', { name: 'Add question screen' });
  expect(within(dialog).getByRole('option', { name: /One enquiry — Continue — to Received/ })).toBeDisabled();
  await user.keyboard('{Escape}');
  expect(document.body).toHaveClass('wconvert-journey-focus');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add screen' })).toHaveFocus());
  expect(draft()).toEqual(initial);
  await user.click(screen.getByRole('button', { name: 'Add screen' }));
  await user.click(screen.getByRole('menuitem', { name: 'Add question screen' }));
  await user.selectOptions(screen.getByRole('combobox', { name: 'Insert at' }), 'edge:start');
  await user.click(screen.getByRole('button', { name: 'Add screen here' }));
  expect(draft().graph!.edges.find(edge => edge.id === 'start')?.to).toBe(draft().steps.at(-1)!.id);
  await waitFor(() => expect(screen.getByRole('heading', { level: 3, name: draft().steps.at(-1)!.name })).toHaveFocus());
});

it('requires a chosen answer before inserting a relevant follow-up from the toolbar', async () => {
  const user = userEvent.setup();
  render(<Editor initial={graphFixture as unknown as TemplateTree} />);
  await user.click(screen.getByRole('button', { name: 'Manage screens' }));
  await user.click(screen.getByRole('button', { name: 'Add screen' }));
  await user.click(screen.getByRole('menuitem', { name: 'Add relevant follow-up' }));
  await user.selectOptions(screen.getByRole('combobox', { name: 'Insert at' }), 'edge:start');
  expect(screen.getByRole('button', { name: 'Add screen here' })).toBeDisabled();
  await user.selectOptions(screen.getByRole('combobox', { name: 'Includes this choice' }), 'balcony');
  await user.click(screen.getByRole('button', { name: 'Add screen here' }));
  expect(draft().steps.at(-1)?.when?.clauses[0]).toEqual({ question: 'n1', operator: 'includes_any', values: ['balcony'] });
});

it('clears stale branch instructions when Undo restores the prior draft', async () => {
  const user = userEvent.setup();
  const initial = graphFixture as unknown as TemplateTree;
  function HistoryEditor() {
    const [tree, setTree] = useState(initial);
    const [step, setStep] = useState(0);
    return <><button onClick={() => setTree(initial)}>Undo fixture edit</button>
      <JourneyEditor embedded tree={tree} step={step} onChange={setTree} onSelect={setStep} /></>;
  }
  render(<HistoryEditor />);
  await user.click(await screen.findByRole('button', { name: 'Draw test branch' }));
  expect(screen.getByText(/Answer path added after the existing priorities/)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Undo fixture edit' }));
  expect(screen.queryByText(/Answer path added after the existing priorities/)).not.toBeInTheDocument();
});
it('opens a drawn graph branch for repair without guessing its condition', async () => {
  const user = userEvent.setup();
  render(<Editor initial={graphFixture as unknown as TemplateTree} />);
  await user.click(screen.getByRole('button', { name: 'Manage screens' }));
  await user.click(await screen.findByRole('button', { name: 'Draw test branch' }));
  expect(draft().graph!.edges.at(-1)).toMatchObject({ from: 'interests', to: 'contact', kind: 'answer',
    when: { clauses: [{ question: 'n1', values: [''] }] } });
  expect(screen.getByText(/Answer path added after the existing priorities/)).toBeInTheDocument();
  expect(screen.getByText('1. If the answer matches')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Next screen' })).toHaveAttribute('aria-pressed', 'true');
});

it('reviews newly unreachable screens before applying a canvas reconnection', async () => {
  const user = userEvent.setup();
  render(<Editor initial={graphFixture as unknown as TemplateTree} />);
  await user.click(screen.getByRole('button', { name: 'Manage screens' }));
  await user.click(await screen.findByRole('button', { name: 'Reconnect test route' }));
  expect(screen.getByRole('heading', { name: 'Review this path change' })).toBeInTheDocument();
  const explanation = screen.getByText(/These screens would become unreachable:/);
  for (const name of ['Garden details', 'Indoor details', 'Balcony details']) expect(explanation).toHaveTextContent(name);
  expect(draft().graph!.edges.find(edge => edge.id === 'start')?.to).toBe('garden');
  await user.click(screen.getByRole('button', { name: 'Apply path change' }));
  expect(draft().graph!.edges.find(edge => edge.id === 'start')?.to).toBe('contact');
  expect(draft().steps).toEqual(graphFixture.steps);
});
it('reviews a canvas save bypass even when no screens are disconnected', async () => {
  const user = userEvent.setup();
  render(<Editor initial={graphFixture as unknown as TemplateTree} />);
  await user.click(screen.getByRole('button', { name: 'Manage screens' }));
  await user.click(await screen.findByRole('button', { name: 'Bypass test save' }));
  expect(screen.getByRole('alertdialog')).toHaveTextContent('could reach “Received” without saving at “One enquiry”');
  expect(draft().graph!.edges.find(edge => edge.id === 'balcony_hidden')?.to).toBe('contact');
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.getByRole('heading', { name: 'Balcony details' })).toHaveFocus();
  expect(draft().graph!.edges.find(edge => edge.id === 'balcony_hidden')?.to).toBe('contact');
});
it.each([true, false])('restores focus after closing Test journey (embedded: %s)', async embedded => {
  const user = userEvent.setup();
  render(<JourneyEditor embedded={embedded} tree={source.tree as TemplateTree} step={0} onChange={() => {}} onSelect={() => {}} />);
  if (!embedded) await user.click(screen.getByRole('button', { name: 'Manage screens' }));
  await user.click(screen.getByRole('button', { name: 'Test journey' }));
  expect(screen.getByRole('dialog', { name: 'Test journey' })).toBeInTheDocument();
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Test journey' })).toHaveFocus());
});
it('opens a requested graph repair on its source screen and path settings', async () => {
  const base = graphFixture as unknown as TemplateTree;
  const tree: TemplateTree = { ...base, graph: { ...base.graph!, edges: [...base.graph!.edges,
    { id: 'repair', from: 'interests', to: 'balcony', kind: 'answer',
      when: { match: 'all', clauses: [{ question: 'n1', operator: 'includes_any', values: [] }] } },
  ] } };
  function RepairEditor() {
    const [step, setStep] = useState(0);
    return <JourneyEditor embedded tree={tree} step={step} onChange={() => {}} onSelect={setStep}
      repairRequest={{ serial: 1, screenId: 'interests', section: 'paths', edgeId: 'repair' }} />;
  }
  render(<RepairEditor />);
  expect(await screen.findByRole('heading', { name: 'Interests' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Next screen' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('checkbox', { name: 'Garden' })).toHaveFocus();
});
it('focuses a visibility repair once and lets the merchant continue editing', async () => {
  const user = userEvent.setup();
  const base = graphFixture as unknown as TemplateTree;
  function RepairEditor() {
    const [tree, setTree] = useState<TemplateTree>({ ...base, steps: base.steps.map(item => item.id === 'garden'
      ? { ...item, when: { match: 'all', clauses: [{ question: 'deleted', operator: 'is', values: ['old'] }] } } : item) });
    const [step, setStep] = useState(0);
    return <JourneyEditor embedded tree={tree} step={step} onChange={setTree} onSelect={setStep}
      repairRequest={{ serial: 1, screenId: 'garden', section: 'content' }} />;
  }
  render(<RepairEditor />);
  const question = await screen.findByRole('combobox', { name: 'Question' });
  await waitFor(() => expect(question).toHaveFocus());
  await user.selectOptions(question, 'n1');
  const balcony = screen.getByRole('checkbox', { name: 'Balcony' });
  await user.click(balcony);
  await waitFor(() => expect(balcony).toBeChecked());
  expect(balcony).toHaveFocus();
});

it('lets a merchant choose several answers for a multi-select condition', async () => {
  const user = userEvent.setup();
  const sourceQuestion = { id: 'interests', type: 'question', label: 'Your interests', answer_type: 'multi', required: true,
    options: [{ value: 'garden', label: 'Garden' }, { value: 'indoors', label: 'Indoors' }, { value: 'other', label: 'Other' }] } as QuestionNode & { id: string };
  function Rule() {
    const [condition, setCondition] = useState<QuestionCondition>({ match: 'all', clauses: [
      { question: 'interests', operator: 'includes_any', values: ['garden'] },
    ] });
    return <><ConditionSettings value={condition} sources={[sourceQuestion]} onChange={next => next && setCondition(next)} required />
      <output data-testid="condition">{JSON.stringify(condition)}</output></>;
  }
  render(<Rule />);
  await user.click(screen.getByRole('checkbox', { name: 'Indoors' }));
  expect(JSON.parse(screen.getByTestId('condition').textContent!).clauses[0].values).toEqual(['garden', 'indoors']);
  await user.selectOptions(screen.getByRole('combobox', { name: 'Comparison' }), 'includes_none');
  expect(screen.getByText('None of these answers')).toBeInTheDocument();
  await user.click(screen.getByRole('checkbox', { name: 'Garden' }));
  expect(JSON.parse(screen.getByTestId('condition').textContent!).clauses[0].values).toEqual(['indoors']);
});
async function action(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('button', { name: 'Screen actions' }));
  await user.click(screen.getByRole('menuitem', { name }));
}
it('adds and removes an optional SMS signup without changing the primary field ownership', async () => {
  const user = userEvent.setup();
  render(<Editor />);
  await user.click(screen.getByRole('button', { name: 'Manage screens' }));
  await user.click(screen.getByRole('button', {name:'Add screen'}));
  await user.click(screen.getByRole('menuitem', {name:'Add optional signup'}));
  const tree = draft();
  expect(tree.submissions).toHaveLength(2);
  expect(tree.submissions[0].fields).toEqual(source.tree.submissions[0].fields);
  expect(tree.submissions[1]).toMatchObject({id:'sms-signup',required:false});
  expect(tree.submissions[1].fields).toHaveLength(1);
  expect(tree.submissions[1].consents).toHaveLength(1);
  expect(screen.getByLabelText('Screen name')).toHaveValue('Optional SMS signup');
  await action(user, 'Delete screen');
  expect(draft().submissions).toHaveLength(1);
  expect(draft().steps).toHaveLength(2);
});
it('keeps an explicit forward path connected when adding an optional signup', async () => {
  const user = userEvent.setup();
  const base = structuredClone(source.tree) as TemplateTree;
  const initial: TemplateTree = { ...base, steps: [{ ...base.steps[0], paths: [{ to: base.steps[1].id }] }, ...base.steps.slice(1)] };
  render(<Editor initial={initial} />);
  await user.click(screen.getByRole('button', { name: 'Manage screens' }));
  await user.click(screen.getByRole('button', { name: 'Add screen' }));
  await user.click(screen.getByRole('menuitem', { name: 'Add optional signup' }));
  const tree = draft();
  expect(tree.steps[0].paths).toEqual([{ to: tree.steps[1].id }]);
  expect(tree.steps[1].paths).toEqual([{ to: tree.steps[2].id }]);
});

it('lets a merchant add optional capture to a graph quiz and move it before the result', async () => {
  const user = userEvent.setup();
  render(<Editor initial={upgradeToGraph(finder.tree as TemplateTree)} />);
  await user.click(screen.getByRole('button', { name: 'Manage screens' }));
  await user.click(screen.getByRole('button', { name: 'Screens' }));
  await user.click(screen.getByRole('button', { name: /Your result Shows a selected result/ }));
  expect(screen.getByRole('radio', { name: 'Immediately after the questions' })).toBeChecked();
  await user.click(screen.getByRole('button', { name: 'Add optional signup' }));
  expect(draft().submissions[0].required).toBe(false);
  expect(screen.getByText(/Visitors may skip this signup and finish without saving contact details/)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /Your result Shows a selected result/ }));
  await user.click(screen.getByRole('radio', { name: 'After required contact details' }));
  expect(draft().submissions[0].required).toBe(true);
  expect(draft().graph?.edges.find(edge => edge.to === 'match')?.from).toBe(draft().steps.find(item => item.name === 'Contact details')?.id);
  expect(screen.getByRole('radio', { name: 'After required contact details' })).toBeChecked();
  expect(screen.getByText(/Contact details are now required before the result/)).toBeInTheDocument();
});
it('preserves screen identity when reordering and gives a duplicate its own identity', async () => {
  const user = userEvent.setup();
  render(<Editor />);
  await user.click(screen.getByRole('button', { name: 'Manage screens' }));
  await user.click(screen.getByRole('button', {name:'Add screen'}));
  await user.click(screen.getByRole('menuitem', {name:'Add offer screen'}));
  const added = draft().steps[0].id;
  const backs = (tree: TemplateTree, index: number) => walkNodes(tree.steps[index].content)
    .filter(node => node.type === 'button' && 'action' in node && node.action === 'back');
  expect(backs(draft(), 0)).toHaveLength(0);
  expect(backs(draft(), 1)).toHaveLength(1);
  fireEvent.change(screen.getByLabelText('Screen name'),{target:{value:'Invitation'}});
  await action(user, 'Move later');
  expect(draft().steps[1]).toMatchObject({id:added,name:'Invitation'});
  expect(backs(draft(), 0)).toHaveLength(0);
  expect(backs(draft(), 1)).toHaveLength(1);
  await action(user, 'Duplicate');
  const tree = draft();
  expect(tree.steps).toHaveLength(4);
  expect(new Set(tree.steps.map(s=>s.id)).size).toBe(4);
  expect(tree.steps.at(-1)?.kind).toBe('acknowledgement');
});
it('keeps a duplicated screen on an explicit incoming path', async () => {
  const user = userEvent.setup();
  const base = structuredClone(source.tree) as TemplateTree;
  const initial: TemplateTree = { ...base, steps: [
    { ...base.steps[0], paths: [{ to: 'offer' }] },
    { id: 'offer', name: 'Offer', kind: 'content', content: { type: 'button', action: 'next', label: 'Continue' } },
    base.steps[1],
  ] };
  render(<Editor initial={initial} />);
  await user.click(screen.getByRole('button', { name: 'Manage screens' }));
  await user.click(screen.getByRole('button', { name: 'Screens' }));
  await user.click(screen.getByRole('button', { name: /Offer Continue only/ }));
  await action(user, 'Duplicate');
  const tree = draft();
  expect(tree.steps[0].paths).toEqual([{ to: tree.steps[1].id }]);
  expect(tree.steps[1].paths).toEqual([{ to: 'offer' }]);
});

it('labels screen actions and refuses unavailable moves', async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  const user = userEvent.setup();
  render(<Editor />);
  await user.click(screen.getByRole('button', { name: 'Manage screens' }));
  const original = draft();
  await user.click(screen.getByRole('button', { name: 'Screen actions' }));
  const earlier = screen.getByRole('menuitem', { name: 'Move earlier' });
  expect(earlier).toHaveAttribute('data-disabled');
  await user.click(earlier);
  expect(draft()).toEqual(original);
});

it('keeps management off the canvas and restores focus after choosing a screen to design', async () => {
  const user = userEvent.setup();
  render(<Editor />);
  expect(screen.queryByLabelText('Screen name')).not.toBeInTheDocument();
  const trigger = screen.getByRole('button', { name: 'Manage screens' });
  await user.click(trigger);
  const dialog = screen.getByRole('dialog', { name: 'Manage screens' });
  await user.click(within(dialog).getByRole('button', { name: 'Screens' }));
  const cards = within(dialog).getByRole('list', { name: 'Journey screen inventory' });
  await user.click(within(cards).getAllByRole('button')[1]);
  expect(screen.getByLabelText('Screen name')).toHaveValue(source.tree.steps[1].name);
  await user.click(screen.getByRole('button', { name: 'Screen actions' }));
  expect(screen.getByRole('menuitem', { name: 'Delete screen' })).toHaveAttribute('data-disabled');
  await user.keyboard('{Escape}');
  await user.click(screen.getByRole('button', { name: 'Edit design' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

it('starts the embedded journey with a readable overview and can return to it after editing', async () => {
  const user = userEvent.setup();
  render(<JourneyEditor embedded tree={source.tree as TemplateTree} step={0} onChange={() => {}} onSelect={() => {}} />);
  expect(screen.getByLabelText('Journey map')).toBeInTheDocument();
  expect(screen.queryByLabelText('Selected screen settings')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Screens' }));
  expect(screen.getByLabelText('Selected screen settings')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Close screen settings' }));
  expect(screen.getByRole('list', { name: 'Journey screen inventory' })).toBeInTheDocument();
  expect(screen.queryByLabelText('Selected screen settings')).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('searchbox', { name: 'Find a screen' })).toHaveFocus());
});

it('opens on the flow and creates an ordered answer path through the inspector', async () => {
  const user = userEvent.setup();
  render(<Editor initial={service.tree as TemplateTree} />);
  await user.click(screen.getByRole('button', { name: 'Manage screens' }));
  expect(screen.getByRole('button', { name: 'Flow' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByLabelText('Journey map')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Next screen' }));
  await user.click(screen.getByRole('button', { name: 'Add answer path' }));
  const paths = draft().steps[0].paths!;
  expect(paths).toHaveLength(2);
  expect(paths[0]).toMatchObject({ to: 'contact', when: { clauses: [{ question: 'n2', values: ['design'] }] } });
  expect(paths[1]).toEqual({ to: 'repair' });
  expect(draft().steps[0].paths?.[0].when?.clauses[0].values).toEqual(['design']);
  await user.click(screen.getByRole('button', { name: 'Remove path' }));
  expect(draft().steps[0].paths).toBeUndefined();
});

it('inserts a screen on the selected branch without changing its condition or continuation', async () => {
  const user = userEvent.setup();
  render(<Editor initial={service.tree as TemplateTree} />);
  await user.click(screen.getByRole('button', { name: 'Manage screens' }));
  await user.click(screen.getByRole('button', { name: 'Next screen' }));
  await user.click(screen.getByRole('button', { name: 'Add answer path' }));
  const before = draft();
  await user.click(screen.getAllByRole('button', { name: 'Insert on this path' })[0]);
  await user.click(screen.getByRole('menuitem', { name: 'Ask a question' }));
  const next = draft();
  const inserted = next.steps[1];
  expect(next.steps[0].paths?.[0]).toEqual({ ...before.steps[0].paths![0], to: inserted.id });
  expect(inserted.paths).toEqual([{ to: 'contact' }]);
  expect(next.steps[0].paths?.[1]).toEqual(before.steps[0].paths?.[1]);
  expect(walkNodes(inserted.content).some(node => node.type === 'question')).toBe(true);
});

it('keeps an inserted screen hidden when its source is skipped', async () => {
  const user = userEvent.setup();
  render(<Editor initial={service.tree as TemplateTree} />);
  await user.click(screen.getByRole('button', { name: 'Manage screens' }));
  await user.click(screen.getByRole('button', { name: 'Screens' }));
  await user.click(screen.getByRole('button', { name: /Repair details Continue only/ }));
  await user.click(screen.getByRole('button', { name: 'Next screen' }));
  await user.click(screen.getByRole('button', { name: 'Insert on this path' }));
  await user.click(screen.getByRole('menuitem', { name: 'Show a message' }));
  const next = draft();
  expect(next.steps[2].when).toEqual(next.steps[1].when);
  expect(next.steps[2].paths).toEqual([{ to: 'contact' }]);
});

it('explains a sample route without changing the campaign draft', async () => {
  const user = userEvent.setup();
  render(<Editor initial={service.tree as TemplateTree} />);
  await user.click(screen.getByRole('button', { name: 'Manage screens' }));
  await user.click(screen.getByRole('button', { name: 'Try answers' }));
  const sample = screen.getByRole('complementary', { name: 'Sample visitor' });
  expect(within(sample).getByText('Repair details')).toBeInTheDocument();
  expect(within(sample).getByText('Its show condition did not match.')).toBeInTheDocument();
  await user.click(within(sample).getByRole('radio', { name: 'Repair' }));
  expect(within(sample).queryByText('Its show condition did not match.')).not.toBeInTheDocument();
  expect(within(sample).getByText('1 simulated submission')).toBeInTheDocument();
  expect(draft()).toEqual(service.tree);
});

it('replaces a referenced answer in visibility, paths and results as one tree change', () => {
  const base = structuredClone(rules.steps) as TemplateTree['steps'][number][];
  const question = base[0].content as import('@renderer/types').QuestionNode;
  base[0] = { ...base[0], content: { ...question, options: [...question.options!, { value: 'indoor', label: 'Indoor' }] },
    paths: [{ to: 'size', when: { match: 'all', clauses: [{ question: 'q_project', operator: 'is', values: ['garden'] }] } }, { to: 'result' }] };
  const tree = { v: 2, steps: base, submissions: [] } as TemplateTree;
  const next = replaceAnswer(tree, 'q_project', 'garden', 'indoor');
  expect((next.steps[0].content as import('@renderer/types').QuestionNode).options?.map(option => option.value)).toEqual(['balcony', 'indoor']);
  expect(next.steps[0].paths?.[0].when?.clauses[0].values).toEqual(['indoor']);
  expect(next.steps[1].when?.clauses[0].values).toEqual(['indoor']);
  expect(next.steps[3].results?.[0].when?.clauses[0].values).toEqual(['indoor']);
  expect((tree.steps[0].content as import('@renderer/types').QuestionNode).options).toHaveLength(3);
});

it('keeps the primary signup ahead of optional signup and the acknowledgement last', () => {
  const tree = progressive.tree as TemplateTree;
  expect(movedScreen(tree, 0, 1)).toBe(tree);
  expect(movedScreen(tree, 1, 0)).toBe(tree);
  expect(movedScreen(tree, tree.steps.length - 1, 0)).toBe(tree);
  expect(movedScreen(tree, 0, tree.steps.length - 1)).toBe(tree);
});


function splitSignup(): TemplateTree {
  const base = structuredClone(progressive.tree) as TemplateTree;
  const content = base.steps[1].content as unknown as { children: import('@renderer/types').TemplateNode[] };
  const phone = content.children.find(n => n.type === 'field')!;
  content.children = content.children.filter(n => n !== phone);
  return referencedJourney({ ...base, steps: [base.steps[0], {
    id: 'phone-question', name: 'Phone question', kind: 'input', content: { type: 'stack', children: [phone, { type: 'button', action: 'next', label: 'Continue' }] },
  }, base.steps[1], base.steps[2]] });
}

it('removes optional owned input screens but preserves interleaved offers and repairs skip navigation', () => {
  const base = splitSignup();
  const tree = referencedJourney({ ...base, steps: [base.steps[0], base.steps[1], {
    id: 'offer', name: 'Your offer', kind: 'content', content: { type: 'stack', children: [
      { type: 'text', text: 'Your discount is ready' }, { type: 'button', action: 'next', label: 'Continue' },
      { type: 'button', action: 'skip', submission: base.submissions[1].id, label: 'Skip SMS' },
    ] },
  }, base.steps[2], base.steps[3]] });
  const next = removedScreen(tree, 3);
  expect(next.steps.map(s => s.id)).toEqual([base.steps[0].id, 'offer', base.steps[3].id]);
  expect(next.submissions).toEqual([tree.submissions[0]]);
  expect(next.steps.flatMap(s => walkNodes(s.content)).some(n => 'submission' in n && n.submission === tree.submissions[1].id)).toBe(false);
  expect(removedScreen(tree, 0)).toBe(tree);
  expect(tree.steps).toHaveLength(5);
});

it('names the affected screens before removing a signup spread across multiple screens', async () => {
  const initial = splitSignup();
  const user = userEvent.setup();
  render(<Editor initial={initial} />);
  await user.click(screen.getByRole('button', { name: 'Manage screens' }));
  await user.click(screen.getByRole('button', { name: 'Screens' }));
  await user.click(screen.getByRole('button', { name: /Optional SMS signup Save/ }));
  await action(user, 'Delete screen');
  const confirmation = screen.getByRole('alertdialog');
  expect(confirmation).toHaveTextContent('Phone question, Optional SMS signup');
  await user.click(within(confirmation).getByRole('button', { name: 'Cancel' }));
  expect(draft()).toEqual(initial);
  await action(user, 'Delete screen');
  await user.click(screen.getByRole('button', { name: 'Remove signup screens' }));
  expect(draft().steps).toHaveLength(2);
  expect(draft().submissions).toHaveLength(1);
});

it('removes Back when deleting an introductory screen makes the signup first', () => {
  const base = structuredClone(source.tree) as TemplateTree;
  const content = base.steps[0].content as unknown as { children: import('@renderer/types').TemplateNode[] };
  content.children.push({ type: 'button', action: 'back', label: 'Back' });
  const tree = referencedJourney({ ...base, steps: [{ id: 'intro', name: 'Intro', kind: 'content', content: { type: 'button', action: 'next', label: 'Continue' } }, ...base.steps] });
  const next = removedScreen(tree, 0);
  expect(walkNodes(next.steps[0].content).some(n => 'action' in n && n.action === 'back')).toBe(false);
  expect(next.submissions).toEqual(base.submissions);
});


it('reveals the earned coupon immediately when adding SMS and preserves it when SMS is deleted', async () => {
  const { default: coupon } = await import('../../resources/templates/library/code-reveal.json');
  const user = userEvent.setup();
  const initial = structuredClone(coupon.tree) as TemplateTree;
  const thanks = initial.steps[1].content as unknown as { children: import('@renderer/types').TemplateNode[] };
  thanks.children.push({ type: 'stack', hidden: true, children: [{ type: 'code', text: 'HIDDEN-REWARD' }] } as import('@renderer/types').TemplateNode);
  render(<Editor initial={initial} />);
  await user.click(screen.getByRole('button', { name: 'Manage screens' }));
  await user.click(screen.getByRole('button', { name: 'Add screen' }));
  await user.click(screen.getByRole('menuitem', { name: 'Add optional signup' }));
  const tree = draft();
  const reward = walkNodes(tree.steps[1].content).find(n => n.type === 'code');
  expect(reward).toMatchObject({ text: 'WELCOME10', copy: true });
  expect(JSON.stringify(tree.steps[1])).not.toContain('HIDDEN-REWARD');
  const ids = tree.steps.flatMap(s => walkNodes(s.content)).flatMap(n => 'id' in n ? [n.id] : []);
  expect(new Set(ids).size).toBe(ids.length);

  const { mount } = await import('@renderer/mount');
  const { bindJourney } = await import('@loader/journey');
  const tag = document.createElement('script'); tag.id = 'wconvert-payload'; tag.setAttribute('data-capture', '/capture'); document.body.append(tag);
  const anchor = document.createElement('div'); document.body.append(anchor);
  const template = { tree, tokens: coupon.tokens };
  const mounted = mount({ template, displayType: 'inline', anchor }); mounted.show();
  const captured = vi.fn();
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ grant: 'secret' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'lead' }) });
  vi.stubGlobal('fetch', fetcher);
  bindJourney(mounted, { id: 'campaign', template, capture_contract: 'contract' }, { onCaptured: captured });
  mounted.root!.querySelector<HTMLInputElement>('[name="email"]')!.value = 'visitor@example.com';
  const consent = mounted.root!.querySelector<HTMLInputElement>('[name="consent"]');
  if (consent) consent.checked = true;
  mounted.root!.querySelector<HTMLButtonElement>('[data-action="submit"]')!.click();
  for (let i = 0; i < 12; i++) await Promise.resolve();
  expect(mounted.root!.textContent).toContain('WELCOME10');
  expect(mounted.root!.querySelector('[name="phone"]')).not.toBeNull();
  mounted.close();
  expect(captured).toHaveBeenCalledOnce();
  expect(fetcher).toHaveBeenCalledTimes(2);
  anchor.remove(); tag.remove();

  await action(user, 'Delete screen');
  expect(draft().submissions).toHaveLength(1);
  expect(walkNodes(draft().steps[1].content).find(n => n.type === 'code')).toMatchObject({ text: 'WELCOME10' });
});

it('shows readable screen conditions and edits one result at a time', async () => {
  const user = userEvent.setup();
  const initial = { v: 1, steps: rules.steps, submissions: [] } as unknown as TemplateTree;
  render(<Editor initial={initial} />);
  await user.click(screen.getByRole('button', { name: 'Manage screens' }));
  await user.click(screen.getByRole('button', { name: 'Screens' }));
  const cards = screen.getByRole('list', { name: 'Journey screen inventory' });
  expect(within(cards).getByRole('button', { name: /Garden size.*Show if Project\? is Garden/ })).toBeInTheDocument();
  await user.click(within(cards).getByRole('button', { name: /Result Shows a selected result/ }));
  const results = screen.getByRole('tablist', { name: 'Possible results' });
  const tabs = within(results).getAllByRole('tab');
  expect(tabs).toHaveLength(2);
  expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tabpanel', { name: /Garden/ })).toBeInTheDocument();
  expect(screen.getByLabelText('Heading')).toHaveValue('Garden');
  await user.click(tabs[0]);
  await user.keyboard('{ArrowDown}');
  expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tabpanel', { name: /Everyone else/ })).toBeInTheDocument();
  expect(screen.getByLabelText('Heading')).toHaveValue('Other');
  await user.clear(screen.getByLabelText('Heading'));
  await user.type(screen.getByLabelText('Heading'), 'A place to start');
  expect(draft().steps[3].results?.[0].heading).toBe('Garden');
  expect(draft().steps[3].results?.[1].heading).toBe('A place to start');
});

it('warns when two matching results can receive the same answer', async () => {
  const user = userEvent.setup();
  const initial = { v: 1, steps: structuredClone(rules.steps), submissions: [] } as unknown as TemplateTree;
  const result = initial.steps[3];
  const tree = { ...initial, steps: [...initial.steps.slice(0, 3), { ...result, results: [
    result.results![0], { ...result.results![0], id: 'also-garden', heading: 'More garden ideas' }, result.results![1],
  ] }] } as TemplateTree;
  render(<Editor initial={tree} />);
  await user.click(screen.getByRole('button', { name: 'Manage screens' }));
  await user.click(screen.getByRole('button', { name: 'Screens' }));
  await user.click(screen.getByRole('list', { name: 'Journey screen inventory' }).querySelectorAll('button')[3]);
  expect(screen.getByText(/may match the same answers/)).toBeInTheDocument();
  await user.click(within(screen.getByRole('tablist', { name: 'Possible results' })).getByRole('tab', { name: /More garden ideas/ }));
  await user.click(screen.getByRole('button', { name: 'Move earlier' }));
  expect(draft().steps[3].results?.[0].id).toBe('also-garden');
});

it('focuses the hidden continuation when repairing a required-save bypass', async () => {
  const tree = graphFixture as unknown as TemplateTree;
  function RepairEditor() {
    const [step, setStep] = useState(0);
    return <JourneyEditor embedded tree={tree} step={step} onChange={() => {}} onSelect={setStep}
      repairRequest={{ serial: 1, screenId: 'balcony', section: 'paths', edgeId: 'balcony_hidden', focus: 'hidden-route' }} />;
  }
  render(<RepairEditor />);
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Continue at' })).toHaveFocus());
});

it('focuses the default destination when repairing a required-save bypass', async () => {
  const tree = graphFixture as unknown as TemplateTree;
  function RepairEditor() {
    const [step, setStep] = useState(0);
    return <JourneyEditor embedded tree={tree} step={step} onChange={() => {}} onSelect={setStep}
      repairRequest={{ serial: 1, screenId: 'balcony', section: 'paths', edgeId: 'balcony_next' }} />;
  }
  render(<RepairEditor />);
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Go to' })).toHaveFocus());
});


it('undoes a journey typing burst once and keeps separate fields as separate edits', async () => {
  const user = userEvent.setup();
  const tree = graphFixture as unknown as TemplateTree;
  function HistoryEditor() {
    const [history, setHistory] = useState(historyOf({ name: 'Enquiry', config: { template: { tree, tokens: {} } } }));
    const [step, setStep] = useState(tree.steps.findIndex(item => item.id === 'interests'));
    const labels = draftHistoryLabels(history);
    return <><button onClick={() => setHistory(undo)}>{labels.undo}</button><button onClick={() => setHistory(redo)}>{labels.redo}</button>
      <JourneyEditor tree={history.present.config.template.tree} step={step} onSelect={setStep}
        onChange={(next, key) => setHistory(current => remember(current, { ...current.present, config: { template: { tree: next, tokens: {} } } }, key ? { key, at: Date.now() } : null))} /></>;
  }
  render(<HistoryEditor />);
  await user.click(screen.getByRole('button', { name: 'Manage screens' }));
  await user.type(screen.getByRole('textbox', { name: 'Screen name' }), ' and preferences');
  await user.type(screen.getByRole('textbox', { name: 'Question' }), ' today?');
  // Close the modal to use campaign history, then open it to inspect the result.
  await user.keyboard('{Escape}');
  await user.click(screen.getByRole('button', { name: 'Undo: Edit questions on “Interests and preferences”' }));
  await user.click(screen.getByRole('button', { name: 'Undo: Rename screen “Interests”' }));
  await user.click(screen.getByRole('button', { name: 'Manage screens' }));
  expect(screen.getByRole('textbox', { name: 'Screen name' })).toHaveValue('Interests');
  expect(screen.getByRole('textbox', { name: 'Question' })).toHaveValue('What interests you?');
  await user.keyboard('{Escape}');
  await user.click(screen.getByRole('button', { name: 'Redo: Rename screen “Interests”' }));
  await user.click(screen.getByRole('button', { name: 'Redo: Edit questions on “Interests and preferences”' }));
  await user.click(screen.getByRole('button', { name: 'Manage screens' }));
  expect(screen.getByRole('textbox', { name: 'Question' })).toHaveValue('What interests you? today?');
});

it('opens the specific result and focuses its fallback link when repairing publication', async () => {
  const tree = upgradeToGraph(finder.tree as TemplateTree);
  function RepairEditor() {
    const [step, setStep] = useState(0);
    return <JourneyEditor embedded tree={tree} step={step} onChange={() => {}} onSelect={setStep}
      repairRequest={{ serial: 1, screenId: 'match', section: 'content', resultId: 'balcony', focus: 'result-link' }} />;
  }
  render(<RepairEditor />);
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Heading' })).toHaveValue('Balcony picks'));
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Fallback shop or guide link' })).toHaveFocus());
});


it('returns keyboard focus to the screen control when closing its settings', async () => {
  const user = userEvent.setup();
  render(<JourneyEditor embedded tree={source.tree as TemplateTree} step={0} onChange={() => {}} onSelect={() => {}} />);
  const opener = await screen.findByRole('button', { name: 'Select first screen' });
  await user.click(opener);
  await user.click(screen.getByRole('button', { name: 'Close screen settings' }));
  await waitFor(() => expect(opener).toHaveFocus());
  expect(screen.queryByRole('region', { name: 'Selected screen settings' })).not.toBeInTheDocument();
});

it('reviews a branch deletion, keeps Cancel unchanged, and restores the entire edit with Undo', async () => {
  const user = userEvent.setup();
  const base = graphFixture as unknown as TemplateTree;
  const initial: TemplateTree = { ...base, graph: { ...base.graph!, edges: base.graph!.edges.map(edge => edge.id === 'garden_hidden'
    ? { ...edge, to: 'contact' } : edge) } };
  function RemovalEditor() {
    const [history, setHistory] = useState(historyOf({ name: 'Enquiry', config: { template: { tree: initial, tokens: {} } } }));
    const [step, setStep] = useState(initial.steps.findIndex(item => item.id === 'garden'));
    return <><button onClick={() => setHistory(undo)}>Undo edit</button><button onClick={() => setHistory(redo)}>Redo edit</button>
      <JourneyEditor tree={history.present.config.template.tree} step={step} onSelect={setStep}
        onChange={next => setHistory(current => remember(current, { ...current.present, config: { template: { tree: next, tokens: {} } } }))} />
      <output data-testid="draft">{JSON.stringify(history.present.config.template.tree)}</output></>;
  }
  render(<RemovalEditor />);
  await user.click(screen.getByRole('button', { name: 'Manage screens' }));
  await user.click(screen.getByRole('button', { name: 'Delete screen' }));
  let dialog = screen.getByRole('dialog', { name: 'Delete this screen?' });
  expect(within(dialog).getByRole('button', { name: 'Delete screen' })).toBeDisabled();
  await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Continue incoming paths at' }), 'received');
  expect(within(dialog).getByText(/without saving at “One enquiry”/)).toBeInTheDocument();
  await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  expect(draft()).toEqual(initial);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Delete screen' })).toHaveFocus());
  await user.click(screen.getByRole('button', { name: 'Delete screen' }));
  dialog = screen.getByRole('dialog', { name: 'Delete this screen?' });
  expect(within(dialog).getByRole('combobox')).toHaveValue('');
  await user.selectOptions(within(dialog).getByRole('combobox'), 'contact');
  expect(within(dialog).getByText(/would become unreachable: Indoor details, Balcony details/)).toBeInTheDocument();
  await user.click(within(dialog).getByRole('button', { name: 'Delete screen' }));
  await waitFor(() => expect(screen.getByRole('heading', { level: 3, name: 'One enquiry' })).toHaveFocus());
  const removed = draft();
  expect(removed.steps.map(item => item.id)).not.toContain('garden');
  expect(removed.graph!.edges.find(edge => edge.id === 'start')?.to).toBe('contact');
  await user.keyboard('{Escape}');
  await user.click(screen.getByRole('button', { name: 'Undo edit' }));
  expect(draft()).toEqual(initial);
  await user.click(screen.getByRole('button', { name: 'Redo edit' }));
  expect(draft()).toEqual(removed);
});

it('keeps a protected Delete action focusable and associates the reason with it', async () => {
  const user = userEvent.setup();
  render(<Editor initial={graphFixture as unknown as TemplateTree} />);
  await user.click(screen.getByRole('button', { name: 'Manage screens' }));
  const button = screen.getByRole('button', { name: 'Delete screen' });
  expect(button).toHaveAttribute('aria-disabled', 'true');
  expect(button).toHaveAccessibleDescription(/collects or saves contact details/);
  await user.click(button);
  expect(button).toHaveFocus();
  expect(screen.queryByRole('dialog', { name: 'Delete this screen?' })).not.toBeInTheDocument();
});

it('removes a graph optional signup as one undoable edit and explains its capture scope', async () => {
  const user = userEvent.setup();
  const initial = upgradeToGraph(progressive.tree as TemplateTree);
  function CaptureEditor() {
    const [history, setHistory] = useState(historyOf({ name: 'Signup', config: { template: { tree: initial, tokens: {} } } }));
    const [step, setStep] = useState(initial.steps.findIndex(item => item.id === 'sms'));
    return <><button onClick={() => setHistory(undo)}>Undo edit</button>
      <JourneyEditor tree={history.present.config.template.tree} step={step} onSelect={setStep}
        onChange={next => setHistory(current => remember(current, { ...current.present, config: { template: { tree: next, tokens: {} } } }))} />
      <output data-testid="draft">{JSON.stringify(history.present.config.template.tree)}</output></>;
  }
  render(<CaptureEditor />);
  await user.click(screen.getByRole('button', { name: 'Manage screens' }));
  await user.click(screen.getByRole('button', { name: 'Remove optional signup' }));
  let dialog = screen.getByRole('dialog', { name: 'Remove this optional signup?' });
  expect(within(dialog).getByText(/Previously saved Leads are unchanged/)).toBeInTheDocument();
  await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  expect(draft()).toEqual(initial);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Remove optional signup' })).toHaveFocus());
  await user.click(screen.getByRole('button', { name: 'Remove optional signup' }));
  dialog = screen.getByRole('dialog', { name: 'Remove this optional signup?' });
  await user.click(within(dialog).getByRole('button', { name: 'Remove signup' }));
  expect(draft().submissions).toEqual(initial.submissions.filter(sub => sub.required));
  expect(draft().steps.map(item => item.id)).not.toContain('sms');
  await user.keyboard('{Escape}');
  await user.click(screen.getByRole('button', { name: 'Undo edit' }));
  expect(draft()).toEqual(initial);
});

it('adds graph secondary capture at a named saved path and restores focus after Cancel', async () => {
  const user = userEvent.setup();
  const initial = upgradeToGraph(source.tree as TemplateTree);
  render(<Editor initial={initial} />);
  await user.click(screen.getByRole('button', { name: 'Manage screens' }));
  await user.click(screen.getByRole('button', { name: 'Add screen' }));
  await user.click(screen.getByRole('menuitem', { name: 'Add optional signup' }));
  let dialog = screen.getByRole('dialog', { name: 'Add optional SMS signup' });
  expect(within(dialog).getByRole('combobox', { name: 'Insert after primary signup' })).toHaveValue(`edge:${initial.graph!.edges[0].id}`);
  await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  expect(draft()).toEqual(initial);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add screen' })).toHaveFocus());
  await user.click(screen.getByRole('button', { name: 'Add screen' }));
  await user.click(screen.getByRole('menuitem', { name: 'Add optional signup' }));
  dialog = screen.getByRole('dialog', { name: 'Add optional SMS signup' });
  await user.click(within(dialog).getByRole('button', { name: 'Add signup' }));
  expect(draft().submissions).toHaveLength(2);
  expect(draft().submissions[0]).toEqual(initial.submissions[0]);
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Optional SMS signup', level: 3 })).toHaveFocus());
  expect(screen.getByRole('button', { name: 'Remove optional signup' })).toBeEnabled();
});

it('explains a branched result timing restriction and opens the named paths for repair', async () => {
  const user = userEvent.setup();
  const optional = addGraphResultSignup(upgradeToGraph(finder.tree as TemplateTree));
  const ending = optional.steps.find(item => item.kind === 'acknowledgement')!;
  const initial: TemplateTree = { ...optional, graph: { ...optional.graph!, edges: [
    { id: 'skip-signup', from: 'match', to: ending.id, kind: 'answer', when: { match: 'all', clauses: [{ question: 'n3', operator: 'is', values: ['garden'] }] } },
    ...optional.graph!.edges,
  ] } };
  render(<Editor initial={initial} />);
  await user.click(screen.getByRole('button', { name: 'Manage screens' }));
  await user.click(screen.getByRole('button', { name: 'Screens' }));
  await user.click(screen.getByRole('button', { name: /Your result Shows a selected result/ }));
  expect(screen.getByRole('radio', { name: 'After required contact details' })).toBeDisabled();
  expect(screen.getByText(/Move any answer branches after both screens first/)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Review Your result' }));
  expect(screen.getByRole('button', { name: 'Next screen' })).toHaveAttribute('aria-pressed', 'true');
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Your result' })).toHaveFocus());
  expect(draft()).toEqual(initial);
});
