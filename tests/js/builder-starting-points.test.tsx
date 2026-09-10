import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DisplayRules } from '../../resources/admin/src/builder/rules/DisplayRules';
import { ruleBundle, ruleTypes } from './support/rule-types';
import type { DisplayRulesValue } from '../../resources/admin/src/builder/rules/summaries';

const current: DisplayRulesValue = {
  rules: [{ type: 'time_on_page', seconds: 12 }, { type: 'new_visitor' }, { type: 'future_condition', flag: true }],
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

describe('reviewing a display-rule starting point', () => {
  it('shows page and audience changes for targeting replacement, waits for confirmation and restores cancel focus', async () => {
    const onChange = setup();
    const trigger = screen.getByRole('button', { name: /All eligible visitors/ });
    await userEvent.click(trigger);
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText('Pages')).toBeInTheDocument();
    expect(within(dialog).getByText('Audience')).toBeInTheDocument();
    expect(within(dialog).getByText('URL path: /offers')).toBeInTheDocument();
    expect(within(dialog).getByText(/On every page/)).toBeInTheDocument();
    expect(within(dialog).getByText(/signed in/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Design Undo cannot reverse/)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(trigger).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('button', { name: 'Replace these rules' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ targeting: {} });
  });

  it('shows the actual page scope when one page rule replaces a different single rule', async () => {
    const targeting = { include: [{ type: 'singular', value: 'post' }] };
    const onChange = setup(ruleBundle({ label: 'On posts', targeting, triggers: undefined }));
    await userEvent.click(screen.getByRole('button', { name: /On posts/ }));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText('URL path: /offers')).toBeInTheDocument();
    expect(within(dialog).getByText('Individual content: Posts')).toBeInTheDocument();
    expect(within(dialog).queryByText('Matches 1 page rule')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Replace these rules' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ targeting });
  });

  it('keeps saved page and term references distinguishable and explains exclusion replacement', async () => {
    const targeting = { include: [{ type: 'singular', value: 'post' }], exclude: [{ type: 'url', value: '/private/*' }] };
    const onChange = setup(ruleBundle({ label: 'Public posts', targeting, triggers: undefined }), {
      ...current,
      targeting: { include: [{ type: 'post', value: 42 }], exclude: [{ type: 'term', value: 31 }] },
    });
    await userEvent.click(screen.getByRole('button', { name: /Public posts/ }));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText('Specific page: #42, except Taxonomy term: #31')).toBeInTheDocument();
    expect(within(dialog).getByText('Individual content: Posts, except URL path: /private/*')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('replaces supplied triggers and frequency together while preserving conditions, unknown rules, dates and priority', async () => {
    const onChange = setup(ruleBundle({ label: 'Show immediately', triggers: [{ type: 'page_load' }], frequency: {} }));
    await userEvent.click(screen.getByRole('button', { name: /Show immediately/ }));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText('When it appears')).toBeInTheDocument();
    expect(within(dialog).getByText('Schedule & frequency')).toBeInTheDocument();
    expect(within(dialog).queryByText('Pages')).toBeNull();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Replace these rules' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      rules: [current.rules[1], current.rules[2], { type: 'page_load' }], frequency: {},
    });
  });
});
