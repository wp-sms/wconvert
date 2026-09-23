import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    expect(screen.getByRole('radio', { name: 'After a delay or visitor activity' })).toBeChecked();
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
  it('keeps a UTM shortcut selected while filling its values', async () => {
    setup(); await section('Audience');
    await userEvent.click(screen.getByRole('radio', { name: 'Specific visitors' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add a rule' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Choose a rule' })).getByRole('button', { name: 'utm_campaign' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Add a value for value' }), 'newsletter');
    expect(screen.getByRole('combobox', { name: 'query_param' })).toHaveValue('utm_campaign');
    expect(screen.queryByRole('textbox', { name: 'key' })).not.toBeInTheDocument();
    expect(draft().display_rules!.audience).toMatchObject({ groups: [{ rules: [{ type: 'query_param', key: 'utm_campaign', value: ['newsletter'] }] }] });
  });
  it('retains stable rule IDs while editing a parameter', async () => {
    setup(); await section('Opening moment');
    const before = draft().display_rules!.opening;
    await userEvent.clear(screen.getByRole('spinbutton', { name: 'seconds' }));
    await userEvent.type(screen.getByRole('spinbutton', { name: 'seconds' }), '15');
    const after = draft().display_rules!.opening;
    expect(screen.getByRole('spinbutton', { name: 'seconds' })).toHaveValue(15);
    expect(screen.getByRole('combobox', { name: 'time_on_page' })).toHaveValue('');
    if (before.mode !== 'immediate' && after.mode !== 'immediate') expect(after.rules[0].id).toBe(before.rules[0].id);
  });
  it('keeps automatic requirements when briefly switching to immediate mode', async () => {
    setup(); await section('Opening moment');
    await userEvent.click(screen.getByRole('radio', { name: 'Immediately' }));
    expect(draft().display_rules!.opening).toEqual({ mode: 'immediate' });
    await userEvent.click(screen.getByRole('radio', { name: 'After a delay or visitor activity' }));
    expect(draft().display_rules!.opening).toEqual(initial.display_rules!.opening);
  });
  it('never offers automatic requirements in click mode', async () => {
    setup(); await section('Opening moment'); await userEvent.click(screen.getByRole('radio', { name: 'When someone clicks' }));
    expect(screen.getByText('How to choose a button or link').closest('details')).not.toHaveAttribute('open');
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
    await userEvent.click(screen.getByText('More repeat controls'));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Stop showing it once they close it' }));
    expect(screen.getByText(/Stop after closing is stronger/)).toBeInTheDocument();
    expect(draft().frequency.maxPerSession).toBe(1);
  });
  it('changes repeat presets without discarding completion, dismissal or lifetime limits', async () => {
    setup({ ...initial, frequency: { maxPerSession: 3, cooldownDays: 4, maxImpressions: 9, stopAfterDismiss: false, stopAfterConversion: false } });
    await section('Schedule & limits');
    expect(screen.getByRole('combobox', { name: 'Show automatically' })).toHaveValue('custom');
    expect(draft().frequency.maxPerSession).toBe(3);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Show automatically' }), 'days');
    expect(draft().frequency).toEqual({ cooldownDays: 4, maxImpressions: 9, stopAfterDismiss: false, stopAfterConversion: false });
    const days = screen.getByRole('spinbutton', { name: 'Days to wait between showings' });
    await userEvent.clear(days);
    await userEvent.type(days, '12');
    expect(draft().frequency.cooldownDays).toBe(12);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Show automatically' }), 'session');
    expect(draft().frequency).toEqual({ maxPerSession: 1, maxImpressions: 9, stopAfterDismiss: false, stopAfterConversion: false });
  });
  it('reveals saved schedule dates without changing them during navigation', async () => {
    const schedule = { starts_at: '2027-05-01 09:00', ends_at: '2027-05-07 18:00' };
    const changed = setup({ ...initial, schedule });
    await section('Schedule & limits');
    expect(screen.getByLabelText('Start showing it on')).toBeVisible();
    expect(screen.getByLabelText('Start showing it on')).toHaveValue('2027-05-01T09:00');
    await section('Pages'); await section('Schedule & limits');
    expect(draft().schedule).toEqual(schedule);
    expect(changed).not.toHaveBeenCalled();
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

// HTTP WordPress installs expose getRandomValues, but not secure-context-only randomUUID.
describe('display editing without crypto.randomUUID', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('creates a specific audience and an alternative group', async () => {
    setup();
    await section('Audience');
    await userEvent.click(screen.getByRole('radio', { name: 'Specific visitors' }));
    expect(screen.getByRole('radio', { name: 'Specific visitors' })).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Advanced: alternative audiences' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add alternative audience' }));
    const audience = draft().display_rules!.audience;
    expect(audience.mode).toBe('groups');
    if (audience.mode !== 'groups') throw new Error('Expected specific visitors');
    expect(audience.groups).toHaveLength(2);
    expect(new Set(audience.groups.map(group => group.id)).size).toBe(2);
  });

  it('adds a selected opening rule with a stable ID and closes the picker', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Add a rule' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Choose a rule' })).getByRole('button', { name: 'exit_intent' }));
    expect(screen.queryByRole('dialog', { name: 'Choose a rule' })).toBeNull();
    const opening = draft().display_rules!.opening;
    if (opening.mode === 'immediate') throw new Error('Expected automatic opening');
    expect(opening.rules).toHaveLength(3);
    expect(opening.rules[2]).toMatchObject({ type: 'exit_intent', id: expect.any(String) });
    expect(new Set(opening.rules.map(rule => rule.id)).size).toBe(3);
    await section('Pages'); await section('Opening moment');
    expect(draft().display_rules!.opening).toEqual(opening);
  });
});
