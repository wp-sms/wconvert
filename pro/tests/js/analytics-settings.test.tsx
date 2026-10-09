import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import apiFetch from '@wordpress/api-fetch';
import Settings from '../../modules/analytics/admin/Settings';
vi.mock('@wordpress/api-fetch', () => ({ default: vi.fn() }));
const saved = { settings: { enabled: false, route: 'gtag', measurement_id: '', consent: 'wp', dismissals: false, exclude_managers: true, data_layer: 'dataLayer' }, home: 'https://example.org/', environment: 'production', site_matches: true, excluded: 0, test_url: 'https://example.org/', guide_url: 'https://example.org/guide.html', asset_available: true };
beforeEach(() => { vi.mocked(apiFetch).mockReset(); vi.mocked(apiFetch).mockResolvedValue(saved); });
it('keeps edited settings on save failure and protects dirty navigation', async () => {
  const onEditingStateChange = vi.fn(); render(<Settings onEditingStateChange={onEditingStateChange} />);
  fireEvent.click(await screen.findByLabelText('Enable analytics integration'));
  fireEvent.change(screen.getByLabelText('Measurement ID', { exact: true }), { target: { value: 'g-example123' } });
  await waitFor(() => expect(onEditingStateChange).toHaveBeenLastCalledWith({ dirty: true, busy: false }));
  vi.mocked(apiFetch).mockRejectedValueOnce({ message: 'Save failed' });
  fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
  await screen.findByText('Save failed');
  expect(screen.getByLabelText('Measurement ID', { exact: true })).toHaveValue('G-EXAMPLE123');
  expect(screen.getByLabelText('Enable analytics integration')).toBeChecked();
});
it('only offers diagnostics for same-site URLs and makes GTM setup explicit', async () => {
  render(<Settings />); await screen.findByLabelText('Enable analytics integration');
  fireEvent.click(screen.getByRole('button', { name: 'Test setup' }));
  expect(screen.getByRole('link', { name: 'Open diagnostics' })).toHaveAttribute('href', 'https://example.org/?wconvert-analytics=1');
  fireEvent.change(screen.getByLabelText('Website page URL'), { target: { value: 'https://other.example/' } });
  expect(screen.queryByRole('link', { name: 'Open diagnostics' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Google Tag Manager' }));
  expect(screen.getByText(/Add the WConvert event tag/)).toBeInTheDocument();
  expect(screen.queryByLabelText('Measurement ID', { exact: true })).not.toBeInTheDocument();
});

it('uses a failed region with retry instead of leaving loading copy beside an error', async () => {
  vi.mocked(apiFetch).mockRejectedValueOnce({ message: 'Cannot load settings' });
  render(<Settings />);
  await screen.findByText('Cannot load settings');
  expect(screen.queryByText(/Loading Google Analytics/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByLabelText('Enable analytics integration');
});
it('keeps diagnostics closed for unsaved changes and lets the merchant discard them', async () => {
  render(<Settings />);
  fireEvent.click(await screen.findByLabelText('Enable analytics integration'));
  fireEvent.click(screen.getByRole('button', { name: 'Test setup' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel changes' }));
  expect(screen.getByLabelText('Enable analytics integration')).not.toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Test setup' }));
  expect(screen.getByRole('dialog', { name: 'Test analytics' })).toBeInTheDocument();
});

it('sets up Plausible without Google fields and asks for a fresh consent choice on provider changes', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ ...saved, settings: { ...saved.settings, consent: 'site' } });
  render(<Settings />); await screen.findByLabelText('Enable analytics integration');
  fireEvent.click(screen.getByRole('radio', { name: 'Plausible' }));
  expect(screen.queryByLabelText('Measurement ID', { exact: true })).not.toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'WP Consent API' })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'Existing tracker' })).not.toBeChecked();
  expect(screen.getByRole('link', { name: 'Plausible setup' })).toHaveAttribute('href', saved.guide_url + '#plausible');
  vi.mocked(apiFetch).mockResolvedValueOnce({ ...saved, settings: { ...saved.settings, route: 'plausible' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled());
  expect(apiFetch).toHaveBeenLastCalledWith(expect.objectContaining({ method: 'POST', data: expect.objectContaining({ route: 'plausible', consent: 'wp' }) }));
  fireEvent.click(screen.getByRole('button', { name: 'Test setup' }));
  expect(screen.getByText(/Tests go to the site configured by your Plausible script/)).toBeInTheDocument();
});

it('says “Saved just now” beside Save after a save, and clears it on the next edit', async () => {
  render(<Settings />);
  fireEvent.click(await screen.findByLabelText('Enable analytics integration'));
  vi.mocked(apiFetch).mockResolvedValueOnce({ ...saved, settings: { ...saved.settings, enabled: true } });
  fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
  expect(await screen.findByText('Saved just now')).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Track dismissals'));
  expect(screen.queryByText('Saved just now')).not.toBeInTheDocument();
});

it('names why diagnostics are refused when the analytics script is missing', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ ...saved, asset_available: false });
  render(<Settings />);
  const test = await screen.findByRole('button', { name: 'Test setup' });
  expect(test).toHaveAttribute('aria-disabled', 'true');
  expect(test).toHaveAccessibleDescription(/analytics script is missing/);
});
