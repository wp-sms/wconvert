import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import apiFetch from '@wordpress/api-fetch';
import { SpamProtection } from '../../resources/admin/src/settings-page/SpamProtection';
import { verify } from '../../resources/loader/src/protection';
vi.mock('@wordpress/api-fetch', () => ({ default: vi.fn() }));
vi.mock('../../resources/loader/src/protection', () => ({ verify: vi.fn() }));
const saved = { site_hostname: 'example.test', provider: 'none', site_key: '', has_secret: false, rules_available: false, rules_configured: false, rule_fields: [], diagnostics: { since: 1, counts: {} } };
beforeEach(() => { vi.mocked(verify).mockReset(); vi.mocked(apiFetch).mockReset(); vi.mocked(apiFetch).mockResolvedValue(saved); });
it('offers all three providers without a Pro gate and preserves drafts after failed saves', async () => {
  render(<SpamProtection />);
  fireEvent.change(await screen.findByLabelText('Bot verification'), { target: { value: 'turnstile' } });
  expect(screen.getByRole('option', { name: 'Google reCAPTCHA v2 checkbox' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'hCaptcha' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Site key'), { target: { value: 'site' } });
  fireEvent.change(screen.getByLabelText('Secret key'), { target: { value: 'secret' } });
  vi.mocked(apiFetch).mockRejectedValueOnce({ message: 'Keys are invalid' });
  fireEvent.click(screen.getByRole('button', { name: 'Save spam protection' }));
  await screen.findByText('Keys are invalid');
  expect(screen.getByLabelText('Site key')).toHaveValue('site'); expect(screen.getByLabelText('Secret key')).toHaveValue('secret');
});
it('distinguishes testing from saving and clears successful verification when keys change', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ ...saved, provider: 'turnstile', site_key: 'site', has_secret: true });
  let complete!: (token: string) => void;
  vi.mocked(verify).mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  render(<SpamProtection />);
  fireEvent.click(await screen.findByRole('button', { name: 'Test saved setup' }));
  expect(screen.getByRole('button', { name: 'Testing…' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Save spam protection' })).toBeDisabled();
  await waitFor(() => expect(verify).toHaveBeenCalledOnce());
  complete('verified-token');
  await screen.findByText('Test passed. No lead created or messages sent.');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Test saved setup' })).toHaveFocus());
  expect(apiFetch).toHaveBeenLastCalledWith({ path: '/wconvert/v1/protection/test', method: 'POST', data: { verification_token: 'verified-token' } });
  fireEvent.change(screen.getByLabelText('Site key'), { target: { value: 'edited-key' } });
  expect(screen.queryByText('Test passed. No lead created or messages sent.')).not.toBeInTheDocument();
  // Refused, not busy: it stays focusable and says why.
  const refused = screen.getByRole('button', { name: 'Test saved setup' });
  expect(refused).toHaveAttribute('aria-disabled', 'true');
  expect(refused).toHaveAccessibleDescription('Save changes before testing.');
  fireEvent.click(refused);
  expect(verify).toHaveBeenCalledOnce();
});
it('gives a useful retry message and restores focus when the setup challenge cannot load', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ ...saved, provider: 'turnstile', site_key: 'site', has_secret: true });
  vi.mocked(verify).mockRejectedValue(undefined);
  render(<SpamProtection />);
  fireEvent.click(await screen.findByRole('button', { name: 'Test saved setup' }));
  await screen.findByText('Test failed. Check your saved keys and hostname, then try again.');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Test saved setup' })).toHaveFocus());
  expect(apiFetch).toHaveBeenCalledTimes(2);
  expect(screen.getByText('example.test')).toBeInTheDocument();
});
it('sends an empty secret to retain an existing key and clears it from the UI after saving', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ ...saved, provider: 'turnstile', site_key: 'site', has_secret: true });
  render(<SpamProtection />);
  expect(await screen.findByLabelText('Secret key')).toHaveValue('');
  fireEvent.change(screen.getByLabelText('Site key'), { target: { value: 'new-site' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save spam protection' }));
  await waitFor(() => expect(apiFetch).toHaveBeenLastCalledWith({ path: '/wconvert/v1/protection', method: 'POST', data: { provider: 'turnstile', site_key: 'new-site', secret: '' } }));
  await screen.findByText('Saved just now');
  expect(screen.queryByText(/saved\./i)).not.toBeInTheDocument();
});
it('names every activity count and never prints a stored key', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ ...saved, diagnostics: { since: 1, counts: { honeypot: 1200, some_new_reason: 2 } } });
  render(<SpamProtection />);
  expect(await screen.findByText('Hidden-field rejections')).toBeInTheDocument();
  expect(screen.getByText('Other checks')).toBeInTheDocument();
  expect(screen.queryByText('some_new_reason')).not.toBeInTheDocument();
});
it('offers one way to try a failed first read again', async () => {
  vi.mocked(apiFetch).mockRejectedValueOnce({ message: 'Protection settings are unavailable.' });
  render(<SpamProtection />);
  await screen.findByText('Protection settings are unavailable.');
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByLabelText('Bot verification')).toBeInTheDocument();
});
/** Filters saved under Pro, with Pro gone: the way out is named, and nothing is sold (ADR 0116). */
it('pauses forms over unavailable saved filters without naming a product', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ ...saved, rules_configured: true });
  render(<SpamProtection />);
  expect(await screen.findByText('Forms are paused: saved email filters aren’t available on this site. Remove the filters to resume.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Remove unavailable filters' })).toBeInTheDocument();
  expect(screen.queryByText(/WConvert Pro/)).not.toBeInTheDocument();
});
