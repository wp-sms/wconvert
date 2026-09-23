import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DisplayRules, type DisplayRulesValue } from '../../resources/admin/src/builder/rules/DisplayRules';
import { ruleTypes } from './support/rule-types';
import { displayPlan } from './support/display-entry';

const initial: DisplayRulesValue = { display_rules: displayPlan([{ type: 'time_on_page', seconds: 20 }, { type: 'scroll_depth', percent: 50 }]), targeting: {}, frequency: { maxPerSession: 1, stopAfterDismiss: false }, schedule: {}, priority: 0 };
function setup(value = initial, availability = {}) {
  const changed = vi.fn();
  function Harness() {
    const [draft, setDraft] = useState(value);
    return <><DisplayRules value={draft} vocabulary={ruleTypes(availability)} overlay onChange={patch => { changed(patch); setDraft({ ...draft, ...patch }); }} /><output data-testid="draft">{JSON.stringify(draft)}</output></>;
  }
  render(<Harness />);
  return changed;
}
const draft = () => JSON.parse(screen.getByTestId('draft').textContent!) as DisplayRulesValue;
const section = async (name: string) => userEvent.click(within(screen.getByRole('navigation', { name: 'Display setup sections' })).getByRole('button', { name: new RegExp(name) }));

describe('display workspace', () => {
  it('starts with opening requirements and exposes four labeled sections and a draft summary', () => {
    setup();
    expect(within(screen.getByRole('navigation')).getAllByRole('button')).toHaveLength(4);
    expect(screen.getByRole('radio', { name: 'When requirements are met' })).toBeChecked();
    expect(screen.getByText('This is your draft. Changes go live only when published.')).toBeInTheDocument();
  });
  it('keeps an empty selected-pages choice incomplete after navigating away and back', async () => {
    setup(); await section('Pages'); await userEvent.click(screen.getByRole('radio', { name: 'Selected pages' }));
    await section('Audience'); await section('Pages');
    expect(screen.getByRole('radio', { name: 'Selected pages' })).toBeChecked();
    expect(draft().targeting.mode).toBe('selected');
    expect(screen.getByText('Choose at least one page before publishing.')).toBeInTheDocument();
  });
  it('changes ALL/ANY without changing either threshold and retains it across section changes', async () => {
    setup(); await section('Opening moment');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Match requirements' }), 'all');
    await section('Pages'); await section('Opening moment');
    expect(screen.getByRole('combobox', { name: 'Match requirements' })).toHaveValue('all');
    const opening = draft().display_rules!.opening;
    expect(opening).toMatchObject({ match: 'all', rules: [{ type: 'time_on_page', seconds: 20 }, { type: 'scroll_depth', percent: 50 }] });
  });
  it('starts specific visitors with one group and keeps alternative audiences on demand', async () => {
    setup(); await section('Audience');
    expect(screen.queryByRole('button', { name: 'Add alternative audience' })).toBeNull();
    await userEvent.click(screen.getByRole('radio', { name: 'Specific visitors' }));
    await userEvent.click(screen.getByRole('button', { name: 'Advanced: alternative audiences' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add alternative audience' }));
    const audience = draft().display_rules!.audience;
    expect(audience.mode === 'groups' && audience.groups.length).toBe(2);
    expect(screen.getByText('OR')).toBeInTheDocument();
    expect(screen.getAllByRole('combobox', { name: 'Match requirements' })).toHaveLength(2);
  });
  it('offers account facts in the same audience rule picker as browser facts', async () => {
    setup(); await section('Audience'); await userEvent.click(screen.getByRole('radio', { name: 'Specific visitors' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add a rule' }));
    const picker = screen.getByRole('dialog', { name: 'Choose a rule' });
    expect(within(picker).getByRole('button', { name: 'logged_in' })).toBeInTheDocument();
    expect(within(picker).getByRole('button', { name: 'role' })).toBeInTheDocument();
    await userEvent.click(within(picker).getByRole('button', { name: 'logged_in' }));
    expect(draft().targeting).toEqual({});
    expect(draft().display_rules!.audience).toMatchObject({ mode: 'groups', groups: [{ rules: [{ type: 'logged_in', id: expect.any(String) }] }] });
  });
  it('retains stable rule IDs while editing a parameter', async () => {
    setup(); await section('Opening moment');
    const before = draft().display_rules!.opening;
    await userEvent.clear(screen.getByRole('spinbutton', { name: 'seconds' }));
    await userEvent.type(screen.getByRole('spinbutton', { name: 'seconds' }), '25');
    const after = draft().display_rules!.opening;
    if (before.mode !== 'immediate' && after.mode !== 'immediate') expect(after.rules[0].id).toBe(before.rules[0].id);
  });
  it('keeps automatic requirements when briefly switching to immediate mode', async () => {
    setup(); await section('Opening moment');
    await userEvent.click(screen.getByRole('radio', { name: 'Immediately' }));
    expect(draft().display_rules!.opening).toEqual({ mode: 'immediate' });
    await userEvent.click(screen.getByRole('radio', { name: 'When requirements are met' }));
    expect(draft().display_rules!.opening).toEqual(initial.display_rules!.opening);
  });
  it('never offers automatic requirements in click mode', async () => {
    setup(); await section('Opening moment'); await userEvent.click(screen.getByRole('radio', { name: 'When someone clicks' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add a rule' }));
    const picker = screen.getByRole('dialog', { name: 'Choose a rule' });
    expect(within(picker).getByRole('button', { name: 'click_element' })).toBeInTheDocument();
    expect(within(picker).queryByText('time_on_page')).toBeNull();
  });
  it('explains missing premium capability without offering a disabled rule control', async () => {
    setup(initial, { pro: 'locked' }); await section('Opening moment');
    await userEvent.click(screen.getByRole('button', { name: 'Add a rule' }));
    const picker = screen.getByRole('dialog', { name: 'Choose a rule' });
    expect(within(picker).getByText('exit_intent')).toBeInTheDocument();
    expect(within(picker).queryByRole('button', { name: 'exit_intent' })).toBeNull();
  });
  it('can save a new session allowance and explains the stronger dismissal setting', async () => {
    setup(); await section('Schedule & limits');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Stop showing it once they close it' }));
    expect(screen.getByText(/Stop after closing is stronger/)).toBeInTheDocument();
    expect(draft().frequency.maxPerSession).toBe(1);
  });
  it('opens the lazy sample tester without changing the draft', async () => {
    const changed = setup(); await userEvent.click(screen.getByRole('button', { name: 'Test a sample visit' }));
    expect(await screen.findByRole('dialog', { name: 'Test a sample visit' })).toBeInTheDocument();
    expect(changed).not.toHaveBeenCalled();
  });
  it('shows a repair step for unsupported saved data rather than defaulting to immediate/everyone', () => {
    setup({ ...initial, display_rules: undefined });
    expect(screen.getByRole('alert')).toHaveTextContent('older development rule format');
    expect(draft().display_rules).toBeUndefined();
  });
});
