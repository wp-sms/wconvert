import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import apiFetch from '@wordpress/api-fetch';
import type { TemplateTree } from '@renderer/types';
import { refusable } from '../../resources/admin/src/lib/refusable';
import { CaptureChangeDialog } from '../../resources/admin/src/builder/CaptureChangeDialog';
import { CommercePicker } from '../../resources/admin/src/builder/CommerceControls';
import { LinePill } from '../../resources/admin/src/builder/flow/FlowLines';
import { GraphScreenActions } from '../../pro/modules/journeys/admin/GraphScreenActions';
import { GraphScreenInsert } from '../../pro/modules/journeys/admin/GraphScreenInsert';
import { duplicateGraphScreenReason } from '../../pro/modules/journeys/admin/structure/graphScreenActions';
import { Dialog, DialogContent } from '../../resources/admin/src/components/ui/dialog';
import { GraphRouteSettings } from '../../pro/modules/journeys/admin/GraphRouteSettings';
import { graphChoiceSources } from '../../resources/admin/src/builder/structure/graphConnections';
import fixture from '../fixtures/journey-graph-branch-groups.json';
import enquiry from '../fixtures/journey-graph-enquiry.json';

vi.mock('@wordpress/api-fetch', () => ({ default: vi.fn() }));

/** GUIDELINES §14: a refusal keeps focus, declines the press, and its description is the reason. */
const tree = fixture as unknown as TemplateTree;

afterEach(cleanup);

async function declines(control: HTMLElement, reason: string | RegExp) {
  expect(control).toHaveAttribute('aria-disabled', 'true');
  expect(control).toBeEnabled();
  expect(control).toHaveAccessibleDescription(reason);
  await userEvent.click(control);
  expect(control).toHaveFocus();
}

it('refusable stops a press and a form submit alike, and lets both through once it is not refused', async () => {
  const pressed = vi.fn();
  const submitted = vi.fn();
  function Form() {
    const [refused, setRefused] = useState(true);
    return <>
      <form onSubmit={(event) => { event.preventDefault(); submitted(); }}>
        <input aria-label="Name" />
        <button type="submit" {...refusable(refused ? 'why' : null, pressed)}>Save</button>
      </form>
      <p id="why">Name it first.</p>
      <button type="button" onClick={() => setRefused(false)}>Fix</button>
    </>;
  }
  render(<Form />);
  const save = screen.getByRole('button', { name: 'Save' });
  await declines(save, 'Name it first.');
  await userEvent.type(screen.getByLabelText('Name'), 'x{Enter}');
  expect(pressed).not.toHaveBeenCalled();
  expect(submitted).not.toHaveBeenCalled();

  await userEvent.click(screen.getByRole('button', { name: 'Fix' }));
  expect(save).not.toHaveAttribute('aria-disabled');
  expect(save).not.toHaveAccessibleDescription();
  await userEvent.click(save);
  expect(pressed).toHaveBeenCalledOnce();
  expect(submitted).toHaveBeenCalledOnce();
});

it('the capture box links the reason it cannot make a change', async () => {
  const onConfirm = vi.fn();
  render(<CaptureChangeDialog open onOpenChange={vi.fn()} before={{ tree, tokens: {} } as never} displayType="popup" target={{ capture: 'email' }}
    convert={() => ({ reason: 'This design cannot hold a form.' }) as never} onConfirm={onConfirm} />);
  const confirm = screen.getByRole('button', { name: /Add|Ask|Remove/ });
  await declines(confirm, 'This design cannot hold a form.');
  expect(onConfirm).not.toHaveBeenCalled();
});

it('a full product picker declines Add and points at what to do', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ items: [{ id: 3, name: 'Three' }] });
  const onChange = vi.fn();
  render(<CommercePicker compact max={2} value={[1, 2]} onChange={onChange} />);
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'thr' } });
  await declines(await screen.findByRole('button', { name: 'Add Three' }), 'Remove a product to add another.');
  expect(onChange).not.toHaveBeenCalled();
});

it('a line with no settings to open is words, not a dead button', () => {
  const line = { id: 'l', from: 'a', to: 'b', style: 'solid', label: 'Growing' } as never;
  const rect = { x: 0, y: 0, width: 10, height: 10 };
  const { rerender } = render(<LinePill line={line} rtl={false} rect={rect} fromName="A" toName="B" state={undefined} selected={false} tabbable />);
  expect(screen.queryByRole('button')).toBeNull();
  expect(screen.getByText('Growing')).toBeVisible();
  rerender(<LinePill line={line} rtl={false} rect={rect} fromName="A" toName="B" state={undefined} selected={false} tabbable onLabel={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'Growing: A to B. Edit' })).toBeEnabled();
});

it('a screen that cannot be duplicated says why on the button', async () => {
  const step = tree.steps.findIndex(screen => duplicateGraphScreenReason(tree, screen.id) !== null);
  const onChange = vi.fn();
  render(<GraphScreenActions tree={tree} step={step} onChange={onChange} />);
  await userEvent.click(screen.getByText('Duplicate or move'));
  await declines(screen.getByRole('button', { name: 'Duplicate after this screen' }), duplicateGraphScreenReason(tree, tree.steps[step].id)!);
  expect(onChange).not.toHaveBeenCalled();
});

it('a line after the save does not offer a question it could never keep', () => {
  const saved = enquiry as unknown as TemplateTree;
  render(<GraphRouteSettings tree={saved} step={saved.steps.findIndex(item => item.id === 'contact')} onChange={vi.fn()} onInsert={vi.fn()} />);
  expect(screen.queryByRole('button', { name: 'Ask a question on this line', hidden: true })).toBeNull();
  expect(screen.getByText('Ask questions before this save so their answers are included.')).toBeInTheDocument();
});

it('with no choice question before it, sending answers elsewhere says what it needs', async () => {
  const saved = enquiry as unknown as TemplateTree;
  const source = saved.steps.find(step => graphChoiceSources(saved, step.id).length === 0 || !saved.graph!.edges.some(edge => edge.from === step.id && edge.kind === 'default'))!;
  render(<Dialog open><DialogContent><GraphScreenInsert tree={saved} source={source.id} kind="input" onInsert={vi.fn()} onCancel={vi.fn()} /></DialogContent></Dialog>);
  const branch = screen.getByRole('radio', { name: /Send some answers to a different screen/ });
  expect(branch).toHaveAttribute('aria-disabled', 'true');
  expect(branch).toHaveAccessibleDescription('Needs a choice question before this screen.');
  await userEvent.click(branch);
  expect(branch).toHaveFocus();
  expect(branch).not.toBeChecked();
});

it('a follow-up refuses a form or an ending, with the reason, and keeps the choice it had', async () => {
  const edge = tree.graph!.edges.find(item => item.from === 'scope' && item.kind === 'default')!;
  render(<Dialog open><DialogContent><GraphScreenInsert tree={tree} source="scope" kind="input" initialLocation={`edge:${edge.id}`} onInsert={vi.fn()} onCancel={vi.fn()} /></DialogContent></Dialog>);
  await userEvent.click(screen.getByRole('radio', { name: /Only if…/ }));
  const form = screen.getByRole('radio', { name: 'Form' });
  expect(form).toHaveAttribute('aria-disabled', 'true');
  expect(form).toHaveAccessibleDescription('Not available for a follow-up.');
  await userEvent.click(form);
  expect(form).toHaveFocus();
  expect(form).not.toBeChecked();
  expect(screen.getByRole('radio', { name: /Ask a question/ })).toBeChecked();
});
