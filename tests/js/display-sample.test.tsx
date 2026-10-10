import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SampleVisit from '../../resources/admin/src/builder/rules/SampleVisit';
import type { DisplayRulesValue } from '../../resources/admin/src/builder/rules/summaries';
import { ruleTypes } from './support/rule-types';

const after15 = { mode: 'automatic' as const, match: 'any' as const, minimum_seconds: 0, rules: [{ id: 't', type: 'time_on_page', seconds: 15 }] };
const computersOnly = { mode: 'groups' as const, groups: [{ id: 'g', match: 'all' as const, rules: [{ id: 'd', type: 'device', in: ['desktop'] }] }] };

function sample(patch: Partial<DisplayRulesValue> = {}) {
  const onOpenSection = vi.fn();
  render(<SampleVisit vocabulary={ruleTypes()} onClose={vi.fn()} onOpenSection={onOpenSection} value={{
    display_rules: { audience: { mode: 'everyone' }, opening: after15 }, targeting: {},
    frequency: { maxPerSession: 1 }, schedule: {}, priority: 0, ...patch,
  }} />);
  return onOpenSection;
}
const result = () => screen.getByRole('status');
const choose = (name: string, value: string) => fireEvent.change(screen.getByRole('combobox', { name }), { target: { value } });

describe('Test a visit', () => {
  it('asks only what this campaign’s rules use', () => {
    sample();
    // A Preview tab now, grouped Where / When; a group the rules never ask about is not drawn.
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getAllByRole('group').map(group => group.querySelector('legend')?.textContent)).toEqual(['Where', 'When']);
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
    expect(screen.getByRole('combobox', { name: 'Device' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Before this visit' })).toBeInTheDocument();
    for (const absent of ['Page they’re on', 'Signed in', 'Came from', 'Ad blocker', 'Visit date']) expect(screen.queryByLabelText(absent)).toBeNull();
    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(document.querySelector('details')).toBeNull();
    expect(result()).toHaveTextContent('Opens after 15 seconds');
  });

  it('flips the verdict and says why when the device changes', () => {
    sample({ display_rules: { audience: computersOnly, opening: after15 } });
    expect(result()).toHaveTextContent('Opens after 15 seconds');
    choose('Device', 'mobile');
    expect(result()).toHaveTextContent('Doesn’t open');
    expect(result()).toHaveTextContent('This campaign is for computers only.');
  });

  it('fails Where on an excluded page', () => {
    sample({ targeting: { exclude: [{ type: 'url', value: '/checkout/*' }] } });
    choose('Page they’re on', 'out:0');
    expect(result()).toHaveTextContent('/checkout/* is excluded.');
    const where = screen.getByText('Where does it show?').closest('li')!;
    expect(where).toHaveAttribute('data-status', 'fail');
    expect(where).toHaveTextContent('Excluded: /checkout/*');
  });

  it('offers one fix for a visitor it doesn’t show to', () => {
    const onOpenSection = sample({ display_rules: { audience: computersOnly, opening: after15 } });
    expect(screen.queryByRole('button', { name: 'Fix in Display rules' })).toBeNull();
    choose('Device', 'mobile');
    fireEvent.click(screen.getByRole('button', { name: 'Fix in Display rules' }));
    expect(onOpenSection).toHaveBeenCalledWith('who');
  });

  it('stops a second showing in one visit under Once per visit', () => {
    sample();
    choose('Before this visit', 'this-visit');
    expect(result()).toHaveTextContent('They already saw it this visit (Once per visit).');
    expect(screen.getByText('How often?').closest('li')).toHaveAttribute('data-status', 'fail');
  });

  it('opens the question to change it', () => {
    const onOpenSection = sample();
    fireEvent.click(within(screen.getByText('Who sees it?').closest('li')!).getByRole('button', { name: 'Change: Who sees it?' }));
    expect(onOpenSection).toHaveBeenCalledWith('who');
  });

  it('asks the questions its rules need, and Reset puts the defaults back', () => {
    sample({ display_rules: { audience: { mode: 'groups', groups: [{ id: 'g', match: 'all', rules: [
      { id: 'l', type: 'logged_in', value: true }, { id: 'r', type: 'referrer', in: ['social'] }, { id: 'f', type: 'some_future_rule' },
    ] }] }, opening: after15 }, schedule: { starts_at: '2099-01-01 09:00' } });
    expect(screen.getByRole('combobox', { name: 'Signed in' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Came from' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Visit date' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Does this visitor match: some_future_rule/ })).toBeInTheDocument();
    choose('Signed in', 'yes');
    choose('Came from', 'social');
    choose('Does this visitor match: some_future_rule?', 'yes');
    choose('Visit date', 'pick');
    expect(result()).toHaveTextContent('Opens after 15 seconds');
    fireEvent.click(screen.getByRole('button', { name: 'Reset visitor' }));
    expect(screen.getByRole('combobox', { name: 'Signed in' })).toHaveValue('no');
    expect(screen.getByRole('combobox', { name: 'Visit date' })).toHaveValue('today');
    expect(result()).toHaveTextContent('Doesn’t open');
  });
});
