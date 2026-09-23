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
  it('requires a new exit after minimum time and after another fact changes', () => {
    sample({ mode: 'automatic', match: 'all', minimum_seconds: 15, rules: [{ id: 'exit', type: 'exit_intent' }] });
    const seconds = screen.getByRole('spinbutton', { name: 'Seconds since navigation' });
    fireEvent.change(seconds, { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simulate exit intent' }));
    expect(result()).toHaveTextContent('Does not open for this sample');
    fireEvent.change(seconds, { target: { value: '15' } });
    expect(result()).toHaveTextContent('Does not open for this sample');
    fireEvent.click(screen.getByRole('button', { name: 'Simulate exit intent' }));
    expect(result()).toHaveTextContent('Can open for this sample');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sample page is included and not excluded' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sample page is included and not excluded' }));
    expect(result()).toHaveTextContent('Does not open for this sample');
  });

  it('explicit clicks bypass automatic pacing but retain completion restrictions', () => {
    sample({ mode: 'click', rules: [{ id: 'click', type: 'click_element', selector: '#offer' }] });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Automatic appearance limits, waiting periods and dismissal settings allow opening' }));
    fireEvent.click(screen.getByRole('button', { name: /Simulate click/ }));
    expect(result()).toHaveTextContent('Can open for this sample');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Campaign and site completion restrictions allow opening' }));
    fireEvent.click(screen.getByRole('button', { name: /Simulate click/ }));
    expect(result()).toHaveTextContent('Does not open for this sample');
    expect(result()).toHaveTextContent('A completion restriction prevents opening.');
  });

  it('automatic opening respects pacing and reset clears the sample facts', () => {
    sample({ mode: 'automatic', match: 'all', minimum_seconds: 0, rules: [{ id: 'time', type: 'time_on_page', seconds: 20 }] });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Seconds since navigation' }), { target: { value: '20' } });
    expect(result()).toHaveTextContent('Can open for this sample');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Automatic appearance limits, waiting periods and dismissal settings allow opening' }));
    expect(result()).toHaveTextContent('Automatic pacing prevents opening.');
    fireEvent.click(screen.getByRole('button', { name: 'Reset sample' }));
    expect(screen.getByRole('spinbutton', { name: 'Seconds since navigation' })).toHaveValue(0);
    expect(screen.getByRole('checkbox', { name: 'Automatic appearance limits, waiting periods and dismissal settings allow opening' })).toBeChecked();
    expect(result()).toHaveTextContent('Does not open for this sample');
  });
});
