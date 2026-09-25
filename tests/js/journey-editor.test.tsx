import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { JourneyEditor } from '../../resources/admin/src/builder/JourneyEditor';
import type { TemplateTree } from '@renderer/types';
import { movedScreen, removedScreen, referencedJourney, replaceAnswer, walkNodes } from '../../resources/admin/src/builder/structure/journey';
import progressive from '../../resources/templates/library/journey-email-then-sms.json';
import source from '../../resources/templates/library/journey-email-only.json';
import rules from '../fixtures/journey-rules.json';
import service from '../../pro/modules/journeys/templates/journey-service-enquiry.json';

vi.mock('../../resources/admin/src/builder/Preview', () => ({ Preview: () => <div /> }));
vi.mock('../../resources/admin/src/builder/JourneyMap', () => ({ JourneyMap: () => <div aria-label="Journey map" /> }));
beforeEach(() => vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function Editor({ initial = source.tree as TemplateTree }: { initial?: TemplateTree }) {
  const [tree, setTree] = useState(initial);
  const [step, setStep] = useState(0);
  return <><JourneyEditor tree={tree} step={step} primaryChannel="email" onChange={setTree} onSelect={setStep} />
    <output data-testid="draft">{JSON.stringify(tree)}</output></>;
}
function draft(): TemplateTree { return JSON.parse(screen.getByTestId('draft').textContent!); }
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
it('preserves screen identity when reordering and gives a duplicate its own identity', async () => {
  const user = userEvent.setup();
  render(<Editor />);
  await user.click(screen.getByRole('button', { name: 'Manage screens' }));
  await user.click(screen.getByRole('button', {name:'Add screen'}));
  await user.click(screen.getByRole('menuitem', {name:'Add offer screen'}));
  const added = draft().steps[0].id;
  fireEvent.change(screen.getByLabelText('Screen name'),{target:{value:'Invitation'}});
  await action(user, 'Move later');
  expect(draft().steps[1]).toMatchObject({id:added,name:'Invitation'});
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
  const cards = within(dialog).getByRole('list', { name: 'Screens in visitor order' });
  await user.click(within(cards).getAllByRole('button')[1]);
  expect(screen.getByLabelText('Screen name')).toHaveValue(source.tree.steps[1].name);
  await user.click(screen.getByRole('button', { name: 'Screen actions' }));
  expect(screen.getByRole('menuitem', { name: 'Delete screen' })).toHaveAttribute('data-disabled');
  await user.keyboard('{Escape}');
  await user.click(screen.getByRole('button', { name: 'Edit design' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
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
  const cards = screen.getByRole('list', { name: 'Screens in visitor order' });
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
  await user.click(screen.getByRole('list', { name: 'Screens in visitor order' }).querySelectorAll('button')[3]);
  expect(screen.getByText(/may match the same answers/)).toBeInTheDocument();
  await user.click(within(screen.getByRole('tablist', { name: 'Possible results' })).getByRole('tab', { name: /More garden ideas/ }));
  await user.click(screen.getByRole('button', { name: 'Move earlier' }));
  expect(draft().steps[3].results?.[0].id).toBe('also-garden');
});
