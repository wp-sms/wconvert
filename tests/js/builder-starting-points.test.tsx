import { displayPlan } from './support/display-entry';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StartingPoints } from '../../resources/admin/src/builder/rules/StartingPoints';
import { DisplayRules } from '../../resources/admin/src/builder/rules/DisplayRules';
import { ruleBundle, ruleTypes } from './support/rule-types';
import type { DisplayRulesValue } from '../../resources/admin/src/builder/rules/summaries';

const current: DisplayRulesValue = {
  display_rules: displayPlan([{ type: 'time_on_page', seconds: 12 }], [{ type: 'device', in: ['mobile'] }]),
  targeting: { include: [{ type: 'url', value: '/offers' }], logged_in: true, roles: ['subscriber'] },
  frequency: { maxImpressions: 3 },
  schedule: { starts_at: '2099-09-10 09:00', ends_at: '2099-09-11 09:00' },
  priority: 7,
};

function setup(bundle = ruleBundle({ label: 'All eligible visitors', targeting: {}, triggers: undefined }), value = current) {
  const onChange = vi.fn();
  const vocabulary = ruleTypes();
  vocabulary.targeting.find((type) => type.type === 'url')!.label = 'URL path';
  const singular = vocabulary.targeting.find((type) => type.type === 'singular')!;
  singular.label = 'Individual content';
  singular.params.value.options = [{ value: 'post', label: 'Posts' }];
  vocabulary.targeting.find((type) => type.type === 'post')!.label = 'Specific page';
  vocabulary.targeting.find((type) => type.type === 'term')!.label = 'Taxonomy term';
  render(<DisplayRules value={value} vocabulary={{ ...vocabulary, bundles: [bundle] }} overlay onChange={onChange} />);
  return onChange;
}

describe('reviewing a display-rule display rule set', () => {
  it('shows only page changes for targeting replacement, waits for confirmation and restores cancel focus', async () => {
    const onChange = setup();
    expect(screen.queryByRole('button', { name: /All eligible visitors/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Browse display rule sets' }));
    const trigger = screen.getByRole('button', { name: /All eligible visitors/ });
    await userEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Choose a display rule set' });
    expect(within(dialog).getByText('Pages', { selector: 'strong' })).toBeInTheDocument();
    expect(within(dialog).queryByText('Audience', { selector: 'strong' })).not.toBeInTheDocument();
    expect(within(dialog).getByText('URL path: /offers')).toBeInTheDocument();
    expect(within(dialog).getByText(/On every page/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/mobile/)).not.toBeInTheDocument();
    expect(within(dialog).getByText(/Undo can restore/)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Back to choices' }));
    expect(trigger).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('button', { name: 'Apply to draft' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ targeting: {} });
  });

  it('shows the actual page scope when one page rule replaces a different single rule', async () => {
    const targeting = { include: [{ type: 'singular', value: 'post' }] };
    const onChange = setup(ruleBundle({ label: 'On posts', targeting, triggers: undefined }));
    await userEvent.click(screen.getByRole('button', { name: 'Browse display rule sets' }));
    await userEvent.click(screen.getByRole('button', { name: /On posts/ }));
    const dialog = screen.getByRole('dialog', { name: 'Choose a display rule set' });
    expect(within(dialog).getByText('URL path: /offers')).toBeInTheDocument();
    expect(within(dialog).getByText('Individual content: Posts')).toBeInTheDocument();
    expect(within(dialog).queryByText('Matches 1 page rule')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Apply to draft' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ targeting });
  });

  it('keeps saved page and term references distinguishable and explains exclusion replacement', async () => {
    const targeting = { include: [{ type: 'singular', value: 'post' }], exclude: [{ type: 'url', value: '/private/*' }] };
    const onChange = setup(ruleBundle({ label: 'Public posts', targeting, triggers: undefined }), {
      ...current,
      targeting: { include: [{ type: 'post', value: 42 }], exclude: [{ type: 'term', value: 31 }] },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Browse display rule sets' }));
    await userEvent.click(screen.getByRole('button', { name: /Public posts/ }));
    const dialog = screen.getByRole('dialog', { name: 'Choose a display rule set' });
    expect(within(dialog).getByText('Specific page: #42, except Taxonomy term: #31')).toBeInTheDocument();
    expect(within(dialog).getByText('Individual content: Posts, except URL path: /private/*')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('replaces supplied triggers and frequency together while preserving conditions, unknown rules, dates and priority', async () => {
    const onChange = setup(ruleBundle({ label: 'Show immediately', triggers: [{ type: 'page_load' }], frequency: {} }));
    await userEvent.click(screen.getByRole('button', { name: 'Browse display rule sets' }));
    await userEvent.click(screen.getByRole('button', { name: /Show immediately/ }));
    const dialog = screen.getByRole('dialog', { name: 'Choose a display rule set' });
    expect(within(dialog).getByText('Opening moment', { selector: 'strong' })).toBeInTheDocument();
    expect(within(dialog).getByText('Schedule & limits', { selector: 'strong' })).toBeInTheDocument();
    expect(within(dialog).queryByText('Pages', { selector: 'strong' })).toBeNull();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Apply to draft' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      display_rules: { ...current.display_rules, opening: { mode: 'immediate' } }, frequency: {},
    });
  });
});


describe('finding the right starting point', () => {
  it('combines section and word filters without editing, and preserves them when returning from review', async () => {
    const onApply = vi.fn();
    render(<StartingPoints bundles={[
      ruleBundle({ id: 'session', label: 'Once per session', description: 'One automatic appearance', triggers: undefined, frequency: { maxPerSession: 1 } }),
      ruleBundle({ id: 'scroll', label: 'Wait for scroll', description: 'Open halfway down' }),
    ]} onApply={onApply} describe={() => []} />);
    await userEvent.click(screen.getByRole('button', { name: 'Browse display rule sets' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Settings to change' }), 'how-often');
    expect(screen.queryByRole('button', { name: /Wait for scroll/ })).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole('searchbox'), 'automatic session');
    await userEvent.click(screen.getByRole('button', { name: /Once per session/ }));
    expect(onApply).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Back to choices' }));
    expect(screen.getByRole('searchbox')).toHaveValue('automatic session');
    expect(screen.getByRole('combobox', { name: 'Settings to change' })).toHaveValue('how-often');
    await userEvent.click(screen.getByRole('button', { name: /Once per session/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Apply to draft' }));
    expect(onApply).toHaveBeenCalledExactlyOnceWith({ frequency: { maxPerSession: 1 } });
  });

  it('compiles alternative gestures as OR while preserving audience and repeat settings', async () => {
    const onChange = setup(ruleBundle({ label: 'Change of direction', triggers: [{ type: 'exit_intent' }, { type: 'scroll_up' }] }));
    await userEvent.click(screen.getByRole('button', { name: 'Browse display rule sets' }));
    await userEvent.click(screen.getByRole('button', { name: /Change of direction/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Apply to draft' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ display_rules: {
      ...current.display_rules,
      opening: { mode: 'automatic', match: 'any', minimum_seconds: 0, rules: [
        { type: 'exit_intent', id: expect.any(String) }, { type: 'scroll_up', id: expect.any(String) },
      ] },
    } });
  });
});
