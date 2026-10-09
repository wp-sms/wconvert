import { graphTrace } from '../../resources/loader/src/journey-graph';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { historyOf, remember, undo, redo } from '../../resources/admin/src/builder/structure/history';
import { draftHistoryLabels } from '../../resources/admin/src/builder/structure/draftEditLabel';
import { campaignIssues } from '../../resources/admin/src/builder/readiness/campaignIssues';
import { ruleTypes } from './support/rule-types';
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
import branchGroups from '../fixtures/journey-graph-branch-groups.json';

vi.mock('../../resources/admin/src/builder/Preview', () => ({ Preview: () => <div /> }));
vi.mock('../../resources/admin/src/builder/JourneyMap', () => ({ JourneyMap: ({ onConnect, onReconnect, onSelect, onAdd, onGoToRules, onGoToDestinations }: {
  onGoToRules?(): void; onGoToDestinations?(): void;
  onConnect(source: string, target: string): void; onReconnect(edge: string, target: string): void; onSelect(index: number): void; onAdd(index: number, edgeId?: string): void;
}) => <div aria-label="Journey map">
  {onGoToRules && <button onClick={onGoToRules}>Edit display rules</button>}
  {onGoToDestinations && <button onClick={onGoToDestinations}>Edit destinations</button>}
  <button onClick={() => onSelect(0)}>Select first screen</button>
  <button onClick={() => onAdd(0, 'saved')}>Insert after save</button>
  <button onClick={() => onConnect('interests', 'contact')}>Draw test branch</button>
  <button onClick={() => onReconnect('start', 'contact')}>Reconnect test route</button>
  <button onClick={() => onReconnect('balcony_hidden', 'received')}>Bypass test save</button>
</div> }));
// Journey authoring is offered only where Pro's `journeys` module registered it (ADR 0116).
beforeEach(() => { vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }); window.wconvertAdmin = { exportUrl: '', journeys: true }; });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); delete window.wconvertAdmin; });

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
  expect(screen.queryByRole('dialog', { name: 'Preview & test' })).not.toBeInTheDocument();
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
  const dialog = screen.getByRole('dialog', { name: 'Add a screen' });
  expect(within(dialog).getByRole('option', { name: /One enquiry — Continue — to Received/ })).toBeDisabled();
  await user.keyboard('{Escape}');
  expect(document.body).toHaveClass('wconvert-journey-focus');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add screen' })).toHaveFocus());
  expect(draft()).toEqual(initial);
  await user.click(screen.getByRole('button', { name: 'Add screen' }));
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
  await user.click(screen.getByRole('radio', { name: 'Ask a relevant follow-up' }));
  await user.click(screen.getByRole('button', { name: 'Change location' }));
  await user.selectOptions(screen.getByRole('combobox', { name: 'Insert at' }), 'edge:start');
  expect(screen.getByRole('button', { name: 'Add screen here' })).toHaveAttribute('aria-disabled', 'true');
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

it.each(['followup', 'branch'] as const)('starts a %s from Next screen without confusing skip and branch semantics', async intent => {
  const user = userEvent.setup();
  const initial = graphFixture as unknown as TemplateTree;
  render(<Editor initial={initial} />);
  await user.click(screen.getByRole('button', { name: 'Manage screens' }));
  await user.click(await screen.findByRole('button', { name: 'Select first screen' }));
  await user.click(screen.getByRole('radio', { name: 'Next screen' }));
  const action = intent === 'followup' ? 'Add conditional follow-up' : 'Add branch';
  await user.click(screen.getByRole('button', { name: action }));
  expect(screen.getByRole('radio', { name: intent === 'followup' ? 'Ask a relevant follow-up' : 'Take a different path' })).toBeChecked();
  expect(screen.getByRole('button', { name: 'Add screen here' })).toHaveAttribute('aria-disabled', 'true');
  await user.selectOptions(screen.getByRole('combobox', { name: intent === 'followup' ? 'Show when the answer to' : 'Take this path when the answer to' }), 'n1');
  await user.selectOptions(screen.getByRole('combobox', { name: 'Includes this choice' }), 'garden');
  await user.click(screen.getByRole('radio', { name: /Show a message/ }));
  await user.click(screen.getByRole('button', { name: 'Add screen here' }));
  const next = draft(), added = next.steps.at(-1)!;
  expect(screen.getByRole('textbox', { name: 'Message' })).toBeInTheDocument();
  const fallback = initial.graph!.edges.find(edge => edge.from === initial.steps[0].id && edge.kind === 'default')!;
  if (intent === 'branch') {
    expect(added.when).toBeUndefined();
    expect(next.graph!.edges).toContainEqual(fallback);
    expect(next.graph!.edges.find(edge => edge.to === added.id)?.kind).toBe('answer');
  } else {
    expect(added.when?.clauses[0].values).toEqual(['garden']);
    expect(next.graph!.edges.find(edge => edge.id === fallback.id)?.to).toBe(added.id);
    expect(next.graph!.edges.filter(edge => edge.from === added.id).map(edge => edge.kind)).toEqual(['default', 'hidden']);
  }
});
it('opens a drawn graph branch for repair without guessing its condition', async () => {
  const user = userEvent.setup();
  render(<Editor initial={graphFixture as unknown as TemplateTree} />);
  await user.click(screen.getByRole('button', { name: 'Manage screens' }));
  await user.click(await screen.findByRole('button', { name: 'Draw test branch' }));
  expect(draft().graph!.edges.at(-1)).toMatchObject({ from: 'interests', to: 'contact', kind: 'answer',
    when: { clauses: [{ question: 'n1', values: [''] }] } });
  expect(screen.getByText(/Answer path added after the existing priorities/)).toBeInTheDocument();
  expect(screen.getByText('Check 1 of 1')).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'Next screen' })).toBeChecked();
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
  expect(screen.getByRole('dialog', { name: 'Preview & test' })).toBeInTheDocument();
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
  expect(screen.getByRole('radio', { name: 'Next screen' })).toBeChecked();
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
async function action(user: ReturnType<typeof userEvent.setup>, name: string, confirm = true) {
  await user.click(screen.getByRole('button', { name: 'Screen actions' }));
  const actionName = name === 'Delete screen' && screen.queryByRole('menuitem', { name: 'Remove optional signup' }) ? 'Remove optional signup' : name;
  await user.click(screen.getByRole('menuitem', { name: actionName }));
  if (confirm && actionName === 'Remove optional signup' && screen.queryByRole('button', { name: 'Remove signup' })) await user.click(screen.getByRole('button', { name: 'Remove signup' }));
}
it('adds and removes an optional SMS signup without changing the primary field ownership', async () => {
  const user = userEvent.setup();
  render(<Editor />);
  await user.click(screen.getByRole('button', { name: 'Manage screens' }));
  await user.click(screen.getByRole('button', {name:'More screen options'}));
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
  await user.click(screen.getByRole('button', { name: 'More screen options' }));
  await user.click(screen.getByRole('menuitem', { name: 'Add optional signup' }));
  const tree = draft();
  expect(tree.steps[0].paths).toEqual([{ to: tree.steps[1].id }]);
  expect(tree.steps[1].paths).toEqual([{ to: tree.steps[2].id }]);
});

it('lets a merchant add optional capture to a graph quiz and move it before the result', async () => {
  const user = userEvent.setup();
  render(<Editor initial={upgradeToGraph(finder.tree as TemplateTree)} />);
  await user.click(screen.getByRole('button', { name: 'Manage screens' }));
  await user.click(screen.getByRole('radio', { name: 'Screens' }));
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
  await user.click(screen.getByRole('button', {name:'More screen options'}));
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
  await user.click(screen.getByRole('radio', { name: 'Screens' }));
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
  await user.click(within(dialog).getByRole('radio', { name: 'Screens' }));
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
  await user.click(screen.getByRole('radio', { name: 'Screens' }));
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
  expect(screen.getByRole('radio', { name: 'Flow' })).toBeChecked();
  expect(screen.getByLabelText('Journey map')).toBeInTheDocument();
  await user.click(screen.getByRole('radio', { name: 'Next screen' }));
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
  await user.click(screen.getByRole('radio', { name: 'Next screen' }));
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
  await user.click(screen.getByRole('radio', { name: 'Screens' }));
  await user.click(screen.getByRole('button', { name: /Repair details Continue only/ }));
  await user.click(screen.getByRole('radio', { name: 'Next screen' }));
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
  expect(within(sample).queryByText('Repair details')).not.toBeInTheDocument();
  await user.click(within(sample).getByRole('radio', { name: 'Repair' }));
  expect(within(sample).getByText('Repair details')).toBeInTheDocument();
  expect(within(sample).getByText('Waiting for your choice')).toBeInTheDocument();
  expect(within(sample).queryByText(/submission would be made/)).not.toBeInTheDocument();
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
  await user.click(screen.getByRole('radio', { name: 'Screens' }));
  await user.click(screen.getByRole('button', { name: /Optional SMS signup Save/ }));
  await action(user, 'Delete screen', false);
  const confirmation = screen.getByRole('alertdialog');
  expect(confirmation).toHaveTextContent('Phone question, Optional SMS signup');
  await user.click(within(confirmation).getByRole('button', { name: 'Cancel' }));
  expect(draft()).toEqual(initial);
  await action(user, 'Delete screen', false);
  await user.click(screen.getByRole('button', { name: 'Remove signup' }));
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
  await user.click(screen.getByRole('button', { name: 'More screen options' }));
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
  await user.click(screen.getByRole('radio', { name: 'Screens' }));
  const cards = screen.getByRole('list', { name: 'Journey screen inventory' });
  expect(within(cards).getByRole('button', { name: /Garden size.*Show if Project\? is Garden/ })).toBeInTheDocument();
  await user.click(within(cards).getByRole('button', { name: /Result Shows a selected result/ }));
  const results = screen.getByRole('group', { name: 'Possible results' });
  const choices = within(results).getAllByRole('button', { expanded: true });
  expect(choices).toHaveLength(1);
  expect(screen.getByRole('region', { name: /Garden/ })).toBeInTheDocument();
  expect(screen.getByLabelText('Heading')).toHaveValue('Garden');
  await user.click(choices[0]);
  expect(screen.queryByRole('textbox', { name: 'Heading' })).toBeNull();
  await user.tab();
  await user.keyboard('{Enter}');
  expect(screen.getByRole('button', { name: /Everyone else Default/ })).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('region', { name: /Everyone else/ })).toBeInTheDocument();
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
  await user.click(screen.getByRole('radio', { name: 'Screens' }));
  await user.click(screen.getByRole('list', { name: 'Journey screen inventory' }).querySelectorAll('button')[3]);
  expect(screen.getByText(/may match the same answers/)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Move later' }));
  expect(screen.getByLabelText('Heading')).toHaveValue('Garden');
  await user.click(screen.getByRole('button', { name: 'Move earlier' }));
  await user.click(within(screen.getByRole('group', { name: 'Possible results' })).getByRole('button', { name: /More garden ideas/ }));
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
  await user.click(screen.getByText('Screen options', { selector: 'summary span' }));
  await user.type(screen.getByRole('textbox', { name: 'Screen name' }), ' and preferences');
  await user.type(screen.getByRole('textbox', { name: 'Question' }), ' today?');
  // Close the modal to use campaign history, then open it to inspect the result.
  await user.keyboard('{Escape}');
  await user.click(screen.getByRole('button', { name: 'Undo: Edit questions on “Interests and preferences”' }));
  await user.click(screen.getByRole('button', { name: 'Undo: Rename screen “Interests”' }));
  await user.click(screen.getByRole('button', { name: 'Manage screens' }));
  await user.click(screen.getByText('Screen options', { selector: 'summary span' }));
  expect(screen.getByRole('textbox', { name: 'Screen name' })).toHaveValue('Interests');
  expect(screen.getByRole('textbox', { name: 'Question' })).toHaveValue('What interests you?');
  await user.keyboard('{Escape}');
  await user.click(screen.getByRole('button', { name: 'Redo: Rename screen “Interests”' }));
  await user.click(screen.getByRole('button', { name: 'Redo: Edit questions on “Interests and preferences”' }));
  await user.click(screen.getByRole('button', { name: 'Manage screens' }));
  expect(screen.getByRole('textbox', { name: 'Question' })).toHaveValue('What interests you? today?');
});

it('opens the specific result and focuses its link when repairing publication', async () => {
  const tree = upgradeToGraph(finder.tree as TemplateTree);
  function RepairEditor() {
    const [step, setStep] = useState(0);
    return <JourneyEditor embedded tree={tree} step={step} onChange={() => {}} onSelect={setStep}
      repairRequest={{ serial: 1, screenId: 'match', section: 'content', resultId: 'balcony', focus: 'result-link' }} />;
  }
  render(<RepairEditor />);
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Heading' })).toHaveValue('Balcony picks'));
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Link (optional)' })).toHaveFocus());
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
  let dialog = screen.getByRole('alertdialog', { name: 'Delete this screen?' });
  expect(within(dialog).getByRole('button', { name: 'Delete screen' })).toHaveAttribute('aria-disabled', 'true');
  await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Continue incoming paths at' }), 'received');
  expect(within(dialog).getByText(/without saving at “One enquiry”/)).toBeInTheDocument();
  await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  expect(draft()).toEqual(initial);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Delete screen' })).toHaveFocus());
  await user.click(screen.getByRole('button', { name: 'Delete screen' }));
  dialog = screen.getByRole('alertdialog', { name: 'Delete this screen?' });
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
  expect(screen.queryByRole('alertdialog', { name: 'Delete this screen?' })).not.toBeInTheDocument();
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
  let dialog = screen.getByRole('alertdialog', { name: 'Remove this optional signup?' });
  expect(within(dialog).getByText(/saved leads stay/)).toBeInTheDocument();
  await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  expect(draft()).toEqual(initial);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Remove optional signup' })).toHaveFocus());
  await user.click(screen.getByRole('button', { name: 'Remove optional signup' }));
  dialog = screen.getByRole('alertdialog', { name: 'Remove this optional signup?' });
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
  await user.click(screen.getByRole('radio', { name: /Collect details/ }));
  await user.click(screen.getByRole('button', { name: 'Set up optional signup' }));
  let dialog = screen.getByRole('dialog', { name: 'Add optional SMS signup' });
  expect(within(dialog).getByRole('combobox', { name: 'Insert after the main signup' })).toHaveValue(`edge:${initial.graph!.edges[0].id}`);
  await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  expect(draft()).toEqual(initial);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add screen' })).toHaveFocus());
  await user.click(screen.getByRole('button', { name: 'Add screen' }));
  await user.click(screen.getByRole('radio', { name: /Collect details/ }));
  await user.click(screen.getByRole('button', { name: 'Set up optional signup' }));
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
  await user.click(screen.getByRole('radio', { name: 'Screens' }));
  await user.click(screen.getByRole('button', { name: /Your result Shows a selected result/ }));
  expect(screen.getByRole('radio', { name: 'After required contact details' })).toBeDisabled();
  expect(screen.getByText(/Move any answer branches after both screens first/)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Review Your result' }));
  expect(screen.getByRole('radio', { name: 'Next screen' })).toBeChecked();
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Your result' })).toHaveFocus());
  expect(draft()).toEqual(initial);
});

it('focuses the exact answer on the second question when repairing a blank label', async () => {
  const base = graphFixture as unknown as TemplateTree;
  const tree: TemplateTree = { ...base, steps: base.steps.map(item => item.id === 'interests' ? { ...item, content: { type: 'stack', children: [
    item.content, { type: 'question', id: 'extra', label: 'Second question', answer_type: 'single', required: false, options: [{ value: 'a', label: 'A' }, { value: 'b', label: '' }] },
  ] } } : item) };
  function RepairEditor() {
    const [step, setStep] = useState(0);
    return <JourneyEditor embedded tree={tree} step={step} onChange={() => {}} onSelect={setStep}
      repairRequest={{ serial: 1, screenId: 'interests', section: 'content', questionId: 'extra', choiceIndex: 1, focus: 'questions' }} />;
  }
  render(<RepairEditor />);
  await waitFor(() => expect(screen.getAllByRole('textbox', { name: 'Choice 2' })[1]).toHaveFocus());
});

it.each(['result-heading', 'products-required'] as const)('focuses the %s repair without the inspector stealing focus', async focus => {
  const tree = upgradeToGraph(finder.tree as TemplateTree);
  function RepairEditor() {
    const [step, setStep] = useState(0);
    return <JourneyEditor embedded tree={tree} step={step} onChange={() => {}} onSelect={setStep}
      repairRequest={{ serial: 1, screenId: 'match', section: 'content', ...(focus === 'result-heading' ? { resultId: 'balcony' } : {}), focus }} />;
  }
  render(<RepairEditor />);
  await waitFor(() => expect(focus === 'result-heading' ? screen.getByRole('textbox', { name: 'Heading' })
    : screen.getByRole('checkbox', { name: 'Require live products before publishing' })).toHaveFocus());
});

it('keeps the clicked connection when questions are unavailable after a save', async () => {
  const user = userEvent.setup();
  const tree = graphFixture as unknown as TemplateTree;
  const saved = tree.graph!.edges.find(edge => edge.from === 'contact')!;
  const draft = { ...tree, graph: { ...tree.graph!, edges: tree.graph!.edges.map(edge => edge.id === saved.id ? { ...edge, id: 'saved' } : edge) } };
  render(<JourneyEditor embedded tree={draft} step={0} onChange={() => {}} onSelect={() => {}} />);
  await user.click(await screen.findByRole('button', { name: 'Insert after save' }));
  if (!screen.queryByRole('combobox', { name: 'Insert at' })) await user.click(screen.getByRole('button', { name: 'Change location' }));
  expect(screen.getByRole('combobox', { name: 'Insert at' })).toHaveValue('edge:saved');
  expect(screen.getByRole('radio', { name: /Show a message/ })).toBeChecked();
  expect(screen.getByRole('button', { name: 'Add screen here' })).toBeEnabled();
  await user.click(screen.getByRole('radio', { name: /Finish this path/ }));
  expect(screen.getByRole('combobox', { name: 'Insert at' })).toHaveValue('edge:saved');
  expect(screen.getByRole('button', { name: 'Add screen here' })).toBeEnabled();
});


it('inserts into legacy campaigns as one undoable edit and leaves Cancel unchanged', async () => {
  const user = userEvent.setup();
  const original = source.tree as TemplateTree;
  function UpgradeEditor() {
    const [history, setHistory] = useState(historyOf({ name: 'Signup', config: { template: { tree: original, tokens: {} } } }));
    const [step, setStep] = useState(0);
    return <><button onClick={() => setHistory(undo)}>Undo draft edit</button>
      <JourneyEditor embedded tree={history.present.config.template.tree} step={step} onSelect={setStep}
        onChange={tree => setHistory(current => remember(current, { ...current.present, config: { template: { tree, tokens: {} } } }))}/>
      <output data-testid="draft">{JSON.stringify(history.present.config.template.tree)}</output></>;
  }
  render(<UpgradeEditor/>);
  await user.click(screen.getByRole('button', { name: 'Add screen' }));
  expect(screen.getByRole('dialog', { name: 'Add a screen' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(draft()).toEqual(original);
  await user.click(screen.getByRole('button', { name: 'Add screen' }));
  await user.click(screen.getByRole('radio', { name: /Show a message/ }));
  await user.type(screen.getByRole('textbox', { name: 'Screen name' }), 'Welcome offer');
  await user.click(screen.getByRole('button', { name: 'Add screen here' }));
  expect(draft().graph).toBeDefined();
  expect(draft().steps).toHaveLength(original.steps.length + 1);
  await user.click(screen.getByRole('button', { name: 'Undo draft edit' }));
  expect(draft()).toEqual(original);
});

it('edits campaign context beside the same map and restores the selected screen and invoking focus', async () => {
  const user = userEvent.setup(); const navigate = vi.fn();
  render(<JourneyEditor embedded tree={graphFixture as unknown as TemplateTree} step={0} onSelect={() => {}} onChange={() => {}}
    displaySummary="After 5 seconds" destinationSummary="Local storage" onGoToRules={navigate} onGoToDestinations={navigate}
    contextEditors={{ rules: <label>Delay<input defaultValue="5" /></label>, destinations: <label>Enquiry delivery<input defaultValue="Local" /></label> }} />);
  const map = await screen.findByLabelText('Journey map');
  await user.click(screen.getByRole('button', { name: 'Select first screen' }));
  await user.click(screen.getByRole('button', { name: 'Edit display rules' }));
  expect(screen.getByRole('region', { name: 'Display rules' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Display rules' })).toHaveFocus();
  expect(screen.getByLabelText('Journey map')).toBe(map);
  await user.click(screen.getByRole('button', { name: 'Back to screens' }));
  expect(screen.getByRole('region', { name: 'Selected screen settings' })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Edit display rules' })).toHaveFocus());
  await user.click(screen.getByRole('button', { name: 'Edit destinations' }));
  expect(screen.getByLabelText('Enquiry delivery')).toHaveValue('Local');
  expect(navigate).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Select first screen' }));
  expect(screen.queryByRole('region', { name: 'Destinations' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('Journey map')).toBe(map);
});

/** The side panel is the same editor as the tab, not a second, thinner one. */
it('draws the destination cards and Add in the journey side panel', async () => {
  const user = userEvent.setup();
  const { DestinationsEditor } = await import('../../resources/admin/src/builder/DestinationsEditor');
  const { ready } = await import('../../resources/admin/src/shell/loadable');
  const health = { last_success_at: null, last_error: null, last_error_at: null, consecutive_failures: 0, skipped_captures: 0, last_skipped_at: null };
  const routes = [
    { id: 'a', type: 'wsms', label: 'Enquiry contacts', connection: null, settings: {}, target: null, availability: 'ready' as const, health },
    { id: 'b', type: 'wsms', label: 'Spare route', connection: null, settings: {}, target: null, availability: 'ready' as const, health },
  ];
  const onChange = vi.fn();
  render(<JourneyEditor embedded tree={graphFixture as unknown as TemplateTree} step={0} onSelect={() => {}} onChange={() => {}}
    displaySummary="After 5 seconds" destinationSummary="Enquiry contacts" onGoToRules={() => {}} onGoToDestinations={() => {}}
    contextEditors={{ rules: <p>Rules</p>, destinations: <DestinationsEditor bound={['a']} available={ready(routes)} types={[]} connections={[]}
      onChange={onChange} onRefresh={() => {}} onSaved={() => {}} /> }} />);
  await screen.findByLabelText('Journey map');
  await user.click(screen.getByRole('button', { name: 'Select first screen' }));
  await user.click(screen.getByRole('button', { name: 'Edit destinations' }));
  const panel = within(screen.getByRole('region', { name: 'Destinations' }));
  expect(panel.getByRole('article', { name: 'Enquiry contacts' })).toBeInTheDocument();
  expect(panel.queryByText('Spare route')).toBeNull();
  await user.click(panel.getByRole('button', { name: 'Add destination' }));
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Spare route/ }));
  expect(onChange).toHaveBeenCalledExactlyOnceWith(['a', 'b']);
});

it('opens the exact referenced show condition and returns to its source question without editing the draft', async () => {
  const user = userEvent.setup();
  const initial = graphFixture as unknown as TemplateTree;
  function References() {
    const [step, setStep] = useState(initial.steps.findIndex(item => item.id === 'interests'));
    return <JourneyEditor tree={initial} step={step} onChange={() => { throw new Error('Navigation must not edit the draft'); }} onSelect={setStep} />;
  }
  render(<References />);
  await user.click(screen.getByRole('button', { name: 'Manage screens' }));
  await user.click(screen.getByRole('button', { name: 'Garden details Show condition' }));
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Question' })).toHaveFocus());
  expect(screen.getByRole('checkbox', { name: 'Garden' })).toBeChecked();
  expect(screen.getByRole('combobox', { name: 'Question' }).closest('details')).toHaveAttribute('open');
  await user.click(screen.getByRole('button', { name: 'Back to Interests' }));
  expect(screen.getByRole('textbox', { name: 'Question' })).toHaveValue('What interests you?');
});

it('follows a path to its destination and returns to Next screen without changing the connection', async () => {
  const user = userEvent.setup();
  render(<Editor initial={graphFixture as unknown as TemplateTree} />);
  await user.click(screen.getByRole('button', { name: 'Manage screens' }));
  await user.click(screen.getByRole('radio', { name: 'Next screen' }));
  await user.click(screen.getByRole('button', { name: 'Edit next screen' }));
  expect(screen.getByRole('heading', { level: 3, name: 'Received' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Back to One enquiry' }));
  expect(screen.getByRole('radio', { name: 'Next screen' })).toBeChecked();
  expect(draft()).toEqual(graphFixture);
});

it('lets a two-choice question review references while keeping the two-choice minimum for removal', async () => {
  const user = userEvent.setup();
  render(<Editor initial={upgradeToGraph(finder.tree as TemplateTree)} />);
  await user.click(screen.getByRole('button', { name: 'Manage screens' }));
  await user.click(screen.getAllByRole('button', { name: 'Review uses' })[0]);
  const review = screen.getByRole('region', { name: 'Review answer uses' });
  expect(within(review).getByText(/Keep at least two choices/)).toBeInTheDocument();
  expect(within(review).getByRole('button', { name: /Sunny garden picks/ })).toBeEnabled();
  expect(within(review).queryByRole('button', { name: /Balcony picks/ })).not.toBeInTheDocument();
  await user.selectOptions(within(review).getByRole('combobox', { name: 'Replace its uses with' }), 'balcony');
  expect(within(review).getByRole('button', { name: 'Replace uses & remove' })).toBeDisabled();
});


it('adds a follow-up beside its answer, preserves every relevant path, and undoes it in one edit', async () => {
  const user = userEvent.setup();
  const original = graphFixture as unknown as TemplateTree;
  function Campaign() {
    const [history, setHistory] = useState(historyOf(original));
    const [step, setStep] = useState(2);
    return <><button onClick={() => setHistory(undo)}>Undo test edit</button>
      <JourneyEditor embedded editorCanvas={<div>Actual campaign canvas</div>} tree={history.present} step={step} onSelect={setStep}
        onChange={tree => setHistory(current => remember(current, tree))} />
      <output data-testid="draft">{JSON.stringify(history.present)}</output></>;
  }
  render(<Campaign />);
  await user.click(screen.getByRole('button', { name: 'Add follow-up for Garden' }));
  const dialog = within(screen.getByRole('dialog', { name: 'Add a follow-up question' }));
  expect(dialog.queryByRole('combobox', { name: 'Show when the answer to' })).toBeNull();
  expect(dialog.getByRole('button', { name: 'Add follow-up' })).toHaveAttribute('aria-disabled', 'true');
  await user.type(dialog.getByRole('textbox', { name: 'Question' }), 'What is your garden budget?');
  await user.click(dialog.getByRole('button', { name: 'Add follow-up' }));
  const next = draft();
  const added = next.steps.at(-1)!;
  expect(added.when?.clauses[0]).toEqual({ question: 'n1', operator: 'includes_any', values: ['garden'] });
  expect(walkNodes(added.content).find(node => node.type === 'question')).toMatchObject({ label: 'What is your garden budget?' });
  expect(next.submissions).toEqual(original.submissions);
  for (let mask = 1; mask <= 7; mask++) {
    const selected = ['garden', 'indoors', 'balcony'].filter((_, index) => !!(mask & 1 << index));
    const path = graphTrace(next.steps, next.graph!, { n1: selected }).indices.map(index => next.steps[index].id);
    expect(path.includes(added.id)).toBe(selected.includes('garden'));
    expect(path.filter(id => ['garden', 'indoors', 'balcony'].includes(id))).toEqual(selected);
    expect(path.slice(-2)).toEqual(['contact', 'received']);
  }
  await user.click(screen.getByRole('radio', { name: 'Flow' }));
  await user.click(screen.getByRole('radio', { name: 'Edit' }));
  expect(screen.getByRole('textbox', { name: 'Question' })).toHaveValue('What is your garden budget?');
  await user.click(screen.getByRole('button', { name: 'Undo test edit' }));
  expect(draft()).toEqual(original);
});

it('reviews a shared follow-up continuation change and updates shown and skipped paths together', async () => {
  const user = userEvent.setup();
  const initial = graphFixture as unknown as TemplateTree;
  function Campaign() {
    const [tree, setTree] = useState(initial);
    return <><JourneyEditor embedded editorCanvas={<div />} tree={tree} step={2} onSelect={() => {}} onChange={setTree} />
      <output data-testid="draft">{JSON.stringify(tree)}</output></>;
  }
  render(<Campaign />);
  await user.click(screen.getByRole('radio', { name: 'Next screen' }));
  expect(screen.getByRole('heading', { name: 'Relevant follow-ups' })).toBeInTheDocument();
  expect(screen.queryByRole('combobox', { name: 'Go to' })).toBeNull();
  await user.selectOptions(screen.getByRole('combobox', { name: 'After the relevant questions' }), 'received');
  expect(screen.getByRole('alertdialog', { name: 'Review this path change' })).toBeInTheDocument();
  expect(draft()).toEqual(initial);
  await user.click(screen.getByRole('button', { name: 'Apply path change' }));
  expect(draft().graph!.edges.filter(edge => edge.from === 'balcony').map(edge => edge.to)).toEqual(['received', 'received']);
  expect(draft().graph!.edges.find(edge => edge.id === 'start')?.to).toBe('garden');
});


it.each(['home', 'business'])('adds a follow-up to the matching %s branch without changing the other visitor path', async answer => {
  const user = userEvent.setup();
  const original = branchGroups as unknown as TemplateTree;
  function Campaign() {
    const [tree, setTree] = useState(original);
    const [step, setStep] = useState(original.steps.findIndex(item => item.id === 'scope'));
    return <><JourneyEditor embedded editorCanvas={<div />} tree={tree} step={step} onSelect={setStep} onChange={setTree} />
      <output data-testid="draft">{JSON.stringify(tree)}</output></>;
  }
  render(<Campaign />);
  await user.click(screen.getByRole('button', { name: `Add follow-up for My ${answer}` }));
  await user.type(screen.getByRole('textbox', { name: 'Question' }), 'When would you like to start?');
  await user.click(screen.getByRole('button', { name: 'Add follow-up' }));
  const next = draft();
  const added = next.steps.at(-1)!.id;
  for (const visitor of ['home', 'business']) {
    const path = graphTrace(next.steps, next.graph!, { n1: visitor }).indices.map(index => next.steps[index].id);
    expect(path.includes(added)).toBe(visitor === answer);
    expect(path.filter(id => id !== added)).toEqual(graphTrace(original.steps, original.graph!, { n1: visitor }).indices.map(index => original.steps[index].id));
  }
});


it('asks for placement when a multi-answer choice does not determine a single branch', async () => {
  const user = userEvent.setup();
  const original = structuredClone(branchGroups) as unknown as TemplateTree;
  const at = original.steps.findIndex(item => item.id === 'scope');
  const question = walkNodes(original.steps[at].content).find(node => node.type === 'question') as QuestionNode;
  Object.assign(question, { answer_type: 'multi' });
  const change = vi.fn();
  render(<JourneyEditor embedded editorCanvas={<div />} tree={original} step={at} onSelect={() => {}} onChange={change} />);
  await user.click(screen.getByRole('button', { name: 'Add follow-up for My home' }));
  await user.type(screen.getByRole('textbox', { name: 'Question' }), 'When would you like to start?');
  expect(screen.getByText('This answer can take more than one path. Choose where this follow-up belongs.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add follow-up' })).toHaveAttribute('aria-disabled', 'true');
  const home = original.graph!.edges.find(edge => edge.from === 'scope' && edge.kind === 'answer')!;
  await user.selectOptions(screen.getByRole('combobox', { name: 'Insert at' }), `edge:${home.id}`);
  expect(screen.getByRole('button', { name: 'Add follow-up' })).toBeEnabled();
  await user.click(screen.getByRole('button', { name: 'Add follow-up' }));
  expect(change.mock.calls.at(-1)?.[0].steps.at(-1).when.clauses[0]).toEqual({ question: 'n1', operator: 'includes_any', values: ['home'] });
});

it('restores the pending answer review after editing a referenced branch', async () => {
  const { default: coffee } = await import('../fixtures/journey-graph-coffee.json');
  const initial = coffee.template.tree as unknown as TemplateTree;
  const user = userEvent.setup();
  function ReviewEditor() {
    const [tree, setTree] = useState(initial), [step, setStep] = useState(initial.steps.findIndex(item => item.id === 'brew'));
    return <><JourneyEditor tree={tree} step={step} onSelect={setStep} onChange={setTree} /><output data-testid="draft">{JSON.stringify(tree)}</output></>;
  }
  render(<ReviewEditor />);
  await user.click(screen.getByRole('button', { name: 'Manage screens' }));
  await user.click(screen.getAllByRole('button', { name: 'Review uses' })[1]);
  const review = screen.getByRole('region', { name: 'Review answer uses' });
  await user.selectOptions(within(review).getByRole('combobox', { name: 'Replace its uses with' }), 'press');
  await user.click(within(review).getByText('Stop offering this answer…'));
  await user.click(within(review).getByRole('button', { name: /Your taste Branch 1/ }));
  expect(screen.getByRole('radio', { name: 'Next screen' })).toBeChecked();
  await user.selectOptions(screen.getByRole('combobox', { name: 'Answer' }), 'press');
  const repaired = draft();
  expect(repaired).not.toEqual(initial);
  await user.click(screen.getByRole('button', { name: 'Back to How you brew' }));
  const resumed = screen.getByRole('region', { name: 'Review answer uses' });
  expect(resumed).toHaveTextContent('Filter or pour-over');
  expect(within(resumed).getByRole('combobox', { name: 'Replace its uses with' })).toHaveValue('press');
  expect(within(resumed).getByText('Stop offering this answer…').closest('details')).toHaveAttribute('open');
  await waitFor(() => expect(resumed).toHaveFocus());
  expect(draft()).toEqual(repaired);
});


/** One list feeds every count (ADR 0133): a screen's warning opens the exact control to fix. */
it('opens an incomplete continuation from the screen’s own warning', async () => {
  const user = userEvent.setup();
  const original = structuredClone(graphFixture) as unknown as TemplateTree;
  const tree = { ...original, graph: { ...original.graph!, edges: original.graph!.edges.filter(edge => !(edge.from === 'interests' && edge.kind === 'default')) } };
  const issues = campaignIssues({ template: { tree, tokens: {} }, rules: { display_rules: { audience: { mode: 'everyone' }, opening: { mode: 'immediate' } }, targeting: {}, frequency: {}, schedule: {}, priority: 0 },
    vocabulary: ruleTypes(), displayType: 'popup', outcome: undefined, bound: [], destinations: [], captureMode: 'local' });
  function Editor() {
    const [step, setStep] = useState(0);
    return <JourneyEditor embedded editorCanvas={<div />} tree={tree} step={step} issues={issues} onChange={() => {}} onSelect={setStep} />;
  }
  render(<Editor />);
  expect(screen.queryByRole('button', { name: /Review journey issues/ })).toBeNull();
  await user.click(screen.getByRole('button', { name: /issues? on “Interests”: Choose where visitors continue after/ }));
  await waitFor(() => expect(screen.getByRole('radio', { name: /^Next screen/ })).toBeChecked());
});

it('offers sample answers in Preview & test and clears its predicted path when the draft changes', async () => {
  const user = userEvent.setup();
  const tree = structuredClone(graphFixture) as unknown as TemplateTree;
  const props = { embedded: true, editorCanvas: <div>Canvas</div>, tree, step: 2, onChange: vi.fn(), onSelect: vi.fn(), testRequest: 1 };
  const view = render(<JourneyEditor {...props} />);
  const dialog = await screen.findByRole('dialog', { name: 'Preview & test' });
  await user.click(within(dialog).getByRole('radio', { name: 'Try answers' }));
  expect(within(dialog).getByText(/This predicts a route/)).toBeInTheDocument();
  await user.click(within(dialog).getByRole('button', { name: 'Show sample path on the map' }));
  expect(screen.getByText('Showing the path for your sample answers')).toBeInTheDocument();
  expect(props.onChange).not.toHaveBeenCalled();
  view.rerender(<JourneyEditor {...props} tree={{ ...tree, steps: tree.steps.map((step, at) => at === 2 ? { ...step, name: 'Changed interests' } : step) }} />);
  expect(screen.queryByRole('button', { name: 'Clear test path' })).not.toBeInTheDocument();
});

it('moves keyboard focus inside the preview when reopening Sample answers', async () => {
  const user = userEvent.setup();
  render(<JourneyEditor embedded tree={finder.tree as TemplateTree} step={0} onChange={() => {}} onSelect={() => {}} />);
  await user.click(screen.getByRole('button', { name: 'Test journey' }));
  await user.click(screen.getByRole('radio', { name: 'Try answers' }));
  await user.click(within(screen.getByRole('dialog', { name: 'Preview & test' })).getByRole('button', { name: 'Close' }));
  await user.click(screen.getByRole('button', { name: 'Test journey' }));
  const dialog = screen.getByRole('dialog', { name: 'Preview & test' });
  expect(within(dialog).getByRole('radio', { name: 'Try answers' })).toBeChecked();
  await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
});

it('keeps unsent visitor inputs across design mode switches and omits answer exploration for simple forms', async () => {
  const user = userEvent.setup();
  render(<JourneyEditor embedded editorCanvas={<div>Canvas</div>} tree={source.tree as TemplateTree} step={0} onChange={() => {}} onSelect={() => {}} testRequest={1} />);
  const dialog = await screen.findByRole('dialog', { name: 'Preview & test' });
  const root = () => [...dialog.querySelectorAll('*')].find(node => node.shadowRoot)!.shadowRoot!;
  const email = within(root() as unknown as HTMLElement).getByRole('textbox', { name: /Email address/ });
  await user.type(email, 'draft@example.test');
  await user.click(within(dialog).getByRole('radio', { name: 'Check the design' }));
  expect(within(dialog).queryByRole('radio', { name: 'Try answers' })).not.toBeInTheDocument();
  await user.click(within(within(dialog).getByRole('group', { name: 'What to check' })).getByRole('radio', { name: 'Try as a visitor' }));
  expect(within(root() as unknown as HTMLElement).getByRole('textbox', { name: /Email address/ })).toBe(email);
  expect(email).toHaveValue('draft@example.test');
});

it('offers a free install linear screens only, with no question, condition or path control', async () => {
  delete window.wconvertAdmin;
  const user = userEvent.setup();
  render(<Editor />);
  await user.click(screen.getByRole('button', { name: 'Manage screens' }));
  expect(screen.queryByRole('button', { name: 'Try answers' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Next screen/ })).not.toBeInTheDocument();
  expect(screen.queryByText('Show this screen when…')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'More screen options' }));
  expect(screen.getByRole('menuitem', { name: 'Add offer screen' })).toBeInTheDocument();
  for (const name of ['Add question screen', 'Add relevant follow-up', 'Let answers choose the next screen']) {
    expect(screen.queryByRole('menuitem', { name })).not.toBeInTheDocument();
  }
  await user.keyboard('{Escape}');
  await user.click(screen.getByRole('button', { name: 'Add screen' }));
  const tree = draft();
  expect(tree.steps).toHaveLength(3);
  expect(tree.graph).toBeUndefined();
  expect(tree.steps.some(item => item.paths || item.when || walkNodes(item.content).some(node => node.type === 'question'))).toBe(false);
  expect(screen.queryByText('This design uses questions or answer paths, which this site’s plan can’t display. Visitors see only its first path.')).not.toBeInTheDocument();
});

it('tells a free install it cannot display a journey draft, without naming Pro', async () => {
  delete window.wconvertAdmin;
  const user = userEvent.setup();
  render(<Editor initial={finder.tree as TemplateTree} />);
  await user.click(screen.getByRole('button', { name: 'Manage screens' }));
  expect(screen.getByText('This design uses questions or answer paths, which this site’s plan can’t display. Visitors see only its first path.')).toBeInTheDocument();
  expect(screen.queryByText(/WConvert Pro|requires Pro|needs Pro/)).not.toBeInTheDocument();
  // An imported journey is not edited further on a free install.
  expect(screen.queryByRole('heading', { name: 'Results' })).not.toBeInTheDocument();
  expect(screen.queryByText('When visitors see their result')).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: 'Question' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'More screen options' }));
  expect(screen.queryByRole('menuitem', { name: 'Add question screen' })).not.toBeInTheDocument();
});
