import { useState } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import apiFetch from '@wordpress/api-fetch';
import Campaign from '../../modules/analytics/admin/Campaign';

vi.mock('@wordpress/api-fetch', () => ({ default: vi.fn() }));
beforeEach(() => { vi.mocked(apiFetch).mockReset(); });

function EditableCampaign() {
  const [value, setValue] = useState<unknown>({ off: false, label: 'Spring offer' });
  return <Campaign value={value} onChange={setValue} />;
}

it('retries a failed status read without losing the campaign preferences', async () => {
  vi.mocked(apiFetch).mockRejectedValueOnce({ message: 'Cannot read site analytics' });
  render(<EditableCampaign />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading site analytics');
  await screen.findByText('Cannot read site analytics');
  expect(screen.queryByText(/Loading site analytics/)).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('radio', { name: 'Off for this campaign' }));
  fireEvent.change(screen.getByLabelText('Public analytics label (optional)'), { target: { value: 'Updated offer' } });
  vi.mocked(apiFetch).mockResolvedValueOnce({ settings: { enabled: false } });
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByText('External analytics is off. Campaign sales has a separate site setting.');

  expect(screen.queryByText('Cannot read site analytics')).not.toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'Off for this campaign' })).toBeChecked();
  expect(screen.getByLabelText('Public analytics label (optional)')).toHaveValue('Updated offer');
  expect(apiFetch).toHaveBeenCalledTimes(2);
});

it('links inherited variant preferences without requesting unused site status', () => {
  render(<Campaign parentId="parent-campaign" value={{}} onChange={vi.fn()} />);
  expect(screen.getByRole('link', { name: 'Open parent campaign' })).toBeInTheDocument();
  expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  expect(apiFetch).not.toHaveBeenCalled();
});
