import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PhoneCountryPicker } from '../../resources/admin/src/PhoneCountryPicker';

const countries = [
  { code: 'AM', name: 'Armenia' },
  { code: 'OM', name: 'Oman' },
  { code: 'US', name: 'United States' },
];

describe('phone country picker', () => {
  it('shows one control and searches countries only when opened', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PhoneCountryPicker label="Default country" value="AM" countries={countries} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Default country Armenia' })).toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Default country Armenia' }));
    const search = screen.getByRole('searchbox', { name: 'Search countries' });
    expect(search).toHaveFocus();
    await user.type(search, 'OM');
    expect(screen.getByRole('button', { name: 'Oman' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Armenia' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Oman' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith('OM');
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('offers the site default in the editor and supports keyboard selection', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PhoneCountryPicker label="Starting country" value="site" siteCountry="AM" countries={countries} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Starting country Use site setting (Armenia)' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Starting country Use site setting (Armenia)' }));
    await user.type(screen.getByRole('searchbox'), 'United');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledExactlyOnceWith('US');
  });
});
