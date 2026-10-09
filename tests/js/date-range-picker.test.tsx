import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateRangePicker } from '../../resources/admin/src/shell/DateRangePicker';

describe('the one date control', () => {
  it('names the window and its dates, and applies a preset in one choice', async () => {
    const onChange = vi.fn();
    render(<DateRangePicker label="Report period" value={{ preset: '30' }} presets={['today', '7', '30']}
      summary="Sep 9 – Oct 8, 2026" today="2026-10-09" onChange={onChange} />);
    const trigger = screen.getByRole('button', { name: 'Report period: Last 30 days, Sep 9 – Oct 8, 2026' });
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('radio', { name: 'Today' }));
    expect(onChange).toHaveBeenCalledWith({ preset: 'today' });
    expect(screen.queryByRole('group', { name: 'Report period' })).toBeNull();
  });

  it('applies custom dates only when they make a window', async () => {
    const onChange = vi.fn();
    render(<DateRangePicker label="Period" value={{ preset: 'all' }} presets={['all', '7']} summary={null}
      today="2026-10-09" maxDays={366} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /^Period: Any time/ }));
    await userEvent.click(screen.getByRole('radio', { name: 'Custom dates' }));
    const apply = screen.getByRole('button', { name: 'Apply dates' });
    // Refused with its reason, not removed from the focus order (§14).
    expect(apply).toHaveAttribute('aria-disabled', 'true');
    expect(apply).toHaveAccessibleDescription('Both days are included.');
    await userEvent.type(screen.getByLabelText('From'), '2026-10-05');
    await userEvent.type(screen.getByLabelText('To'), '2026-10-01');
    expect(screen.getByRole('alert')).toHaveTextContent('The first day comes after the last.');
    await userEvent.clear(screen.getByLabelText('To'));
    await userEvent.type(screen.getByLabelText('To'), '2026-10-12');
    expect(screen.getByRole('alert')).toHaveTextContent('The last day can’t be after today.');
    await userEvent.clear(screen.getByLabelText('To'));
    await userEvent.type(screen.getByLabelText('To'), '2026-10-08');
    await userEvent.click(screen.getByRole('button', { name: 'Apply dates' }));
    expect(onChange).toHaveBeenCalledWith({ preset: 'custom', from: '2026-10-05', to: '2026-10-08' });
  });

  it('carries what qualifies the window, such as a comparison', async () => {
    render(<DateRangePicker label="Report period" value={{ preset: '7' }} presets={['7']} summary={null} today={null}
      custom={false} footer={<label><input type="checkbox" /> Compare with the previous period</label>} onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /Report period/ }));
    expect(screen.getByRole('checkbox', { name: 'Compare with the previous period' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Custom dates' })).toBeNull();
  });
});
