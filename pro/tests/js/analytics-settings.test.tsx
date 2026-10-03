import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import apiFetch from '@wordpress/api-fetch';
import Settings from '../../modules/analytics/admin/Settings';
vi.mock('@wordpress/api-fetch', () => ({ default: vi.fn() }));
const saved = { settings: { enabled: false, route: 'gtag', measurement_id: '', consent: 'wp', dismissals: false, exclude_managers: true, data_layer: 'dataLayer' }, home: 'https://example.org/', environment: 'production', site_matches: true, excluded: 0, test_url: 'https://example.org/', guide_url: 'https://example.org/guide.html', asset_available: true };
beforeEach(() => { vi.mocked(apiFetch).mockReset(); vi.mocked(apiFetch).mockResolvedValue(saved); });
it('keeps edited settings on save failure and protects dirty navigation', async () => {
  const onEditingStateChange = vi.fn(); render(<Settings onEditingStateChange={onEditingStateChange} />);
  fireEvent.click(await screen.findByLabelText('Enable GA4 integration'));
  fireEvent.change(screen.getByLabelText('GA4 Measurement ID', { exact: false }), { target: { value: 'g-example123' } });
  await waitFor(() => expect(onEditingStateChange).toHaveBeenLastCalledWith({ dirty: true, busy: false }));
  vi.mocked(apiFetch).mockRejectedValueOnce({ message: 'Save failed' });
  fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
  await screen.findByText('Save failed');
  expect(screen.getByLabelText('GA4 Measurement ID', { exact: false })).toHaveValue('G-EXAMPLE123');
  expect(screen.getByLabelText('Enable GA4 integration')).toBeChecked();
});
it('only offers diagnostics for same-site URLs and makes GTM setup explicit', async () => {
  render(<Settings />); await screen.findByLabelText('Enable GA4 integration');
  fireEvent.click(screen.getByText('Test and verify'));
  expect(screen.getByRole('link', { name: 'Open website diagnostics' })).toHaveAttribute('href', 'https://example.org/?wconvert-analytics=1');
  fireEvent.change(screen.getByLabelText('Website page URL'), { target: { value: 'https://other.example/' } });
  expect(screen.queryByRole('link', { name: 'Open website diagnostics' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Connection method'), { target: { value: 'gtm' } });
  expect(screen.getByText(/Saving here does not publish GTM changes/)).toBeInTheDocument();
  expect(screen.queryByLabelText('GA4 Measurement ID', { exact: false })).not.toBeInTheDocument();
});
