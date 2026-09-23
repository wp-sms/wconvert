import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SampleVisit from '../../resources/admin/src/builder/rules/SampleVisit';
import type { DisplayRulesValue } from '../../resources/admin/src/builder/rules/summaries';
import { ruleTypes } from './support/rule-types';

function sample(opening: NonNullable<DisplayRulesValue['display_rules']>['opening']) {
  render(<SampleVisit vocabulary={ruleTypes()} onClose={vi.fn()} value={{
    display_rules: { audience: { mode: 'everyone' }, opening }, targeting: {},
    frequency: { maxPerSession: 1 }, schedule: {}, priority: 0,
  }} />);
}
const result = () => screen.getByRole('status');

describe('sample visit event semantics', () => {
  it('shows a live verdict for time AND scroll, with assumptions collapsed until requested', () => {
    sample({ mode: 'automatic', match: 'all', minimum_seconds: 0, rules: [
      { id: 'time', type: 'time_on_page', seconds: 20 }, { id: 'scroll', type: 'scroll_depth', percent: 50 },
    ] });
    expect(screen.getByText('Other conditions').closest('details')).not.toHaveAttribute('open');
    expect(screen.getByRole('checkbox', { name: 'Page is allowed' })).not.toBeVisible();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Time on page' }), { target: { value: '10' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Page scrolled' }), { target: { value: '60' } });
    expect(result()).toHaveTextContent('Would not show');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Time on page' }), { target: { value: '25' } });
    expect(result()).toHaveTextContent('Would show');
    fireEvent.click(screen.getByText('Other conditions'));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Page is allowed' }));
    expect(result()).toHaveTextContent('This page is excluded');
    expect(screen.getByText('1 changed')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Other conditions'));
    expect(result()).toHaveTextContent('Would not show');
    fireEvent.click(screen.getByRole('button', { name: 'Reset sample' }));
    expect(screen.getByText('All allowed')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Time on page' })).toHaveValue(0);
  });

  it('omits irrelevant numeric fields for immediate campaigns', () => {
    sample({ mode: 'immediate' });
    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(result()).toHaveTextContent('Would show');
  });

  it('requires a new exit after minimum time and after another fact changes', () => {
    sample({ mode: 'automatic', match: 'all', minimum_seconds: 15, rules: [{ id: 'exit', type: 'exit_intent' }] });
    const seconds = screen.getByRole('spinbutton', { name: 'Time on page' });
    fireEvent.change(seconds, { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simulate exit intent' }));
    expect(result()).toHaveTextContent('Would not show');
    fireEvent.change(seconds, { target: { value: '15' } });
    expect(result()).toHaveTextContent('Would not show');
    fireEvent.click(screen.getByRole('button', { name: 'Simulate exit intent' }));
    expect(result()).toHaveTextContent('Would show');
    fireEvent.click(screen.getByText('Other conditions'));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Page is allowed' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Page is allowed' }));
    expect(result()).toHaveTextContent('Would not show');
  });

  it('explicit clicks bypass automatic pacing but retain completion restrictions', () => {
    sample({ mode: 'click', rules: [{ id: 'click', type: 'click_element', selector: '#offer' }] });
    fireEvent.click(screen.getByText('Other conditions'));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Repeat limits allow another appearance' }));
    fireEvent.click(screen.getByRole('button', { name: /Simulate click/ }));
    expect(result()).toHaveTextContent('Would show');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Completion rules allow another appearance' }));
    fireEvent.click(screen.getByRole('button', { name: /Simulate click/ }));
    expect(result()).toHaveTextContent('Would not show');
    expect(result()).toHaveTextContent('Completion rules stop this visitor from seeing it again.');
  });

  it('automatic opening respects pacing and reset clears the sample facts', () => {
    sample({ mode: 'automatic', match: 'all', minimum_seconds: 0, rules: [{ id: 'time', type: 'time_on_page', seconds: 20 }] });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Time on page' }), { target: { value: '20' } });
    expect(result()).toHaveTextContent('Would show');
    fireEvent.click(screen.getByText('Other conditions'));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Repeat limits allow another appearance' }));
    expect(result()).toHaveTextContent('Repeat limits stop another automatic appearance.');
    fireEvent.click(screen.getByRole('button', { name: 'Reset sample' }));
    expect(screen.getByRole('spinbutton', { name: 'Time on page' })).toHaveValue(0);
    expect(screen.getByRole('checkbox', { name: 'Repeat limits allow another appearance' })).toBeChecked();
    expect(result()).toHaveTextContent('Would not show');
  });
});
