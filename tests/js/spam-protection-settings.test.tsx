import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import apiFetch from '@wordpress/api-fetch';
import { SpamProtection } from '../../resources/admin/src/settings-page/SpamProtection';
vi.mock('@wordpress/api-fetch', () => ({ default: vi.fn() }));
const saved = { provider: 'none', site_key: '', has_secret: false, rules_available: false, rules_configured: false, rule_fields: [], diagnostics: { since: 1, counts: {} } };
beforeEach(() => { vi.mocked(apiFetch).mockReset(); vi.mocked(apiFetch).mockResolvedValue(saved); });
it('offers all three providers without a Pro gate and preserves drafts after failed saves', async () => {
  render(<SpamProtection />);
  fireEvent.change(await screen.findByLabelText('Additional bot protection'), { target: { value: 'turnstile' } });
  expect(screen.getByRole('option', { name: 'Google reCAPTCHA v2 checkbox' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'hCaptcha' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Site key'), { target: { value: 'site' } });
  fireEvent.change(screen.getByLabelText('Secret key'), { target: { value: 'secret' } });
  vi.mocked(apiFetch).mockRejectedValueOnce({ message: 'Keys are invalid' });
  fireEvent.click(screen.getByRole('button', { name: 'Save protection' }));
  await screen.findByText('Keys are invalid');
  expect(screen.getByLabelText('Site key')).toHaveValue('site'); expect(screen.getByLabelText('Secret key')).toHaveValue('secret');
});
it('sends an empty secret to retain an existing key and clears it from the UI after saving', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ ...saved, provider: 'turnstile', site_key: 'site', has_secret: true });
  render(<SpamProtection />);
  expect(await screen.findByLabelText('Secret key')).toHaveValue('');
  fireEvent.change(screen.getByLabelText('Site key'), { target: { value: 'new-site' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save protection' }));
  await waitFor(() => expect(apiFetch).toHaveBeenLastCalledWith({ path: '/wconvert/v1/protection', method: 'POST', data: { provider: 'turnstile', site_key: 'new-site', secret: '' } }));
  await screen.findByText('Protection settings saved.');
});
