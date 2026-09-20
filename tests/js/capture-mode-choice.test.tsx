import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CaptureModeChoice } from '../../resources/admin/src/builder/CaptureModeChoice';

describe('choosing a handoff mode', () => {
  it('explains removal before switching to collect-only when destinations are selected', async () => {
    const onChange = vi.fn();
    const view = render(<CaptureModeChoice mode="connected" selectedCount={2} onChange={onChange} />);
    expect(screen.getByRole('radio', { name: 'Collect only in WConvert' })).toHaveAccessibleDescription(/No automatic sending.*Clears selected destinations/);
    await userEvent.click(screen.getByRole('radio', { name: 'Collect only in WConvert' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith('local');
    view.rerender(<CaptureModeChoice mode="local" selectedCount={0} onChange={onChange} />);
    expect(screen.queryByText(/Clears selected destinations/)).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/Automatic emails and texts need a separate sending setup/);
  });
});
