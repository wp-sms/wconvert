import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup, act, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { JourneyEditor } from '../../resources/admin/src/builder/JourneyEditor';
import type { TemplateTree } from '@renderer/types';
import { movedScreen, removedScreen, referencedJourney, walkNodes } from '../../resources/admin/src/builder/structure/journey';
import progressive from '../../resources/templates/library/journey-email-then-sms.json';
import source from '../../resources/templates/library/journey-email-only.json';

vi.mock('../../resources/admin/src/builder/Preview', () => ({ Preview: () => <div /> }));
beforeEach(() => vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function Editor({ initial = source.tree as TemplateTree }: { initial?: TemplateTree }) {
  const [tree, setTree] = useState(initial);
  const [step, setStep] = useState(0);
  return <><JourneyEditor tree={tree} step={step} primaryChannel="email" onChange={setTree} onSelect={setStep} />
    <output data-testid="draft">{JSON.stringify(tree)}</output></>;
}
function draft(): TemplateTree { return JSON.parse(screen.getByTestId('draft').textContent!); }
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
  fireEvent.click(screen.getByRole('button', {name:'Delete screen'}));
  expect(draft().submissions).toHaveLength(1);
  expect(draft().steps).toHaveLength(2);
});
it('preserves screen identity when reordering and gives a duplicate its own identity', async () => {
  const user = userEvent.setup();
  render(<Editor />);
  await user.click(screen.getByRole('button', { name: 'Manage screens' }));
  await user.click(screen.getByRole('button', {name:'Add screen'}));
  await user.click(screen.getByRole('menuitem', {name:'Add offer screen'}));
  const added = draft().steps[0].id;
  fireEvent.change(screen.getByLabelText('Screen name'),{target:{value:'Invitation'}});
  fireEvent.click(screen.getByRole('button',{name:'Move later'}));
  expect(draft().steps[1]).toMatchObject({id:added,name:'Invitation'});
  fireEvent.click(screen.getByRole('button',{name:'Duplicate'}));
  const tree = draft();
  expect(tree.steps).toHaveLength(4);
  expect(new Set(tree.steps.map(s=>s.id)).size).toBe(4);
  expect(tree.steps.at(-1)?.kind).toBe('acknowledgement');
});

it('labels icon actions on keyboard focus and refuses unavailable moves', async () => {
  // jsdom has no layout observer; tooltip placement is checked in WordPress.
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  const user = userEvent.setup();
  render(<Editor />);
  await user.click(screen.getByRole('button', { name: 'Manage screens' }));
  const original = draft();
  const earlier = screen.getByRole('button', { name: 'Move earlier' });
  expect(earlier).toHaveAttribute('aria-disabled', 'true');
  await act(async () => { earlier.focus(); });
  expect(await screen.findByRole('tooltip')).toHaveTextContent('Move earlier');
  await user.keyboard('{Enter}');
  expect(draft()).toEqual(original);
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});

it('keeps management off the canvas and restores focus after choosing a screen to design', async () => {
  const user = userEvent.setup();
  render(<Editor />);
  expect(screen.queryByLabelText('Screen name')).not.toBeInTheDocument();
  const trigger = screen.getByRole('button', { name: 'Manage screens' });
  await user.click(trigger);
  const dialog = screen.getByRole('dialog', { name: 'Manage screens' });
  const cards = within(dialog).getByRole('list', { name: 'Screens in visitor order' });
  await user.click(within(cards).getAllByRole('button')[1]);
  expect(screen.getByLabelText('Screen name')).toHaveValue(source.tree.steps[1].name);
  expect(screen.getByRole('button', { name: 'Delete screen' })).toHaveAttribute('aria-disabled', 'true');
  await user.click(screen.getByRole('button', { name: 'Edit this screen’s design' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
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
  await user.click(screen.getByRole('button', { name: /Optional SMS signup Save/ }));
  await user.click(screen.getByRole('button', { name: 'Delete screen' }));
  const confirmation = screen.getByRole('alertdialog');
  expect(confirmation).toHaveTextContent('Phone question, Optional SMS signup');
  await user.click(within(confirmation).getByRole('button', { name: 'Cancel' }));
  expect(draft()).toEqual(initial);
  await user.click(screen.getByRole('button', { name: 'Delete screen' }));
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
