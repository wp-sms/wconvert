import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { JourneyEditor } from '../../resources/admin/src/builder/JourneyEditor';
import type { TemplateTree } from '@renderer/types';
import source from '../../resources/templates/library/journey-email-only.json';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function Editor() {
  const [tree, setTree] = useState(source.tree as TemplateTree);
  const [step, setStep] = useState(0);
  return <><JourneyEditor tree={tree} step={step} primaryChannel="email" onChange={setTree} onSelect={setStep} />
    <output data-testid="draft">{JSON.stringify(tree)}</output></>;
}
function draft(): TemplateTree { return JSON.parse(screen.getByTestId('draft').textContent!); }
it('adds and removes an optional SMS signup without changing the primary field ownership', async () => {
  const user = userEvent.setup();
  render(<Editor />);
  await user.click(screen.getByRole('button', {name:'Add screen'}));
  await user.click(screen.getByRole('menuitem', {name:'Add optional signup'}));
  const tree = draft();
  expect(tree.submissions).toHaveLength(2);
  expect(tree.submissions[0].fields).toEqual(source.tree.submissions[0].fields);
  expect(tree.submissions[1]).toMatchObject({id:'sms-signup',required:false});
  expect(tree.submissions[1].fields).toHaveLength(1);
  expect(tree.submissions[1].consents).toHaveLength(1);
  expect(screen.getByLabelText('Screen name')).toHaveValue('Optional SMS signup');
  fireEvent.click(screen.getByRole('button', {name:'Remove optional signup screens'}));
  expect(draft().submissions).toHaveLength(1);
  expect(draft().steps).toHaveLength(2);
});
it('preserves screen identity when reordering and gives a duplicate its own identity', async () => {
  const user = userEvent.setup();
  render(<Editor />);
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
