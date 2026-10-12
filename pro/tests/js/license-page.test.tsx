import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import apiFetch from '@wordpress/api-fetch';
import { LicensePage } from '../../resources/admin/src/license/LicensePage';
import type { LicensePayload } from '../../resources/admin/src/license/describeLicense';

vi.mock('@wordpress/api-fetch', () => ({ default: vi.fn() }));

const none: LicensePayload = {
  state: 'none', error_code: '', retry_at: null, plan: null, expires_at: null, days_left: null, renewal: null, sites: [],
  key: { masked: null, source: null }, buyer: null, domain_change: null,
  updates: { installed: '1.4.2', latest: '1.4.2', file_mods: true, update_url: null, checked_at: null },
  last_checked_at: null, last_success_at: null, reach: 'ok',
  urls: { account: 'https://my.wconvert.io/account', checkout: 'https://wconvert.io/pro/', support: 'https://wconvert.io/support/' },
  managed: null, notice: { dot: null, title: null, row: null },
  badge: { href: '#license', label: 'Activate Pro', prompt: true, tone: null, reason: null },
};

const expired: LicensePayload = {
  ...none, state: 'expired', plan: { slug: '5-sites', label: '5 sites', max: 5, used: 2 }, expires_at: '2026-09-30T00:00:00+00:00', days_left: -12,
  renewal: { mode: 'manual', trial_ends_at: null, grace_ends_at: null, offer: { code: 'RENEW20', percent: 20, until: null } },
  sites: [
    { domain: 'example.com', here: true, dev: false, added: '2026-03-03T10:00:00+00:00', last_seen: null },
    { domain: 'shop.example.com', here: false, dev: false, added: '2026-04-18T10:00:00+00:00', last_seen: null },
  ],
  key: { masked: '••••AB12', source: 'manual' }, buyer: { name: 'S*** K***', email: 's***@example.com' },
  urls: { ...none.urls, renew: 'https://my.wconvert.io/renew', upgrade: 'https://my.wconvert.io/upgrade', sites: 'https://my.wconvert.io/account' },
  notice: { dot: 'red', title: 'Your license expired', row: 'Your license expired, so updates stopped.' },
  badge: { href: '#license', label: null, prompt: false, tone: 'red', reason: 'Your license expired' },
};

const answer = (routes: Record<string, unknown>) => vi.mocked(apiFetch).mockImplementation(((options?: { path: string; method?: string }) => {
  if (!options) return Promise.resolve(undefined);
  const key = `${options.method ?? 'GET'} ${options.path}`;
  return key in routes
    ? (routes[key] instanceof Error || (typeof routes[key] === 'object' && routes[key] !== null && 'code' in (routes[key] as object))
      ? Promise.reject(routes[key]) : Promise.resolve(routes[key]))
    : Promise.resolve({ signed_in: false, email_masked: null, licenses: [], error_code: null, message: null });
}) as never);

beforeEach(() => vi.mocked(apiFetch).mockReset());

it('S1: with nothing activated, sign-in comes first and a key is the second door', async () => {
  answer({ 'GET /wconvert/v1/license': none });
  render(<LicensePage />);

  expect(await screen.findByRole('heading', { name: 'Activate WConvert Pro' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Sign in to your account' })).toBeInTheDocument();
  expect(screen.getByText('Enter a license key instead')).toBeInTheDocument();
});

it('S6 and P6: a refused key says why under the field, and an unknown code is shown, not blanked', async () => {
  answer({ 'GET /wconvert/v1/license': none, 'POST /wconvert/v1/license/activate': { code: 'license_quantum_flux', message: 'x' } });
  render(<LicensePage />);
  await userEvent.click(await screen.findByText('Enter a license key instead'));
  await userEvent.type(screen.getByLabelText('License key'), 'wcv zzzz–0000');
  expect(screen.getByLabelText('License key')).toHaveValue('WCVZZZZ-0000');
  await userEvent.click(screen.getByRole('button', { name: 'Activate' }));

  expect(await screen.findByText('Something went wrong (license_quantum_flux).')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Contact support/ })).toBeInTheDocument();
});

it('M3: expired — red card, renew with the coupon, sites and the key below', async () => {
  answer({ 'GET /wconvert/v1/license': expired });
  render(<LicensePage />);

  expect(await screen.findByRole('heading', { name: 'Your license expired' })).toBeInTheDocument();
  expect(screen.getByText(/Pro features keep working\./)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Renew/ })).toHaveAttribute('href', 'https://my.wconvert.io/renew');
  expect(screen.getByText('RENEW20')).toBeInTheDocument();
  const sites = screen.getByRole('region', { name: 'Sites' });
  expect(within(sites).getByText('This site')).toBeInTheDocument();
  expect(within(sites).queryByRole('button', { name: 'Remove example.com' })).toBeNull();
  expect(within(sites).getByRole('button', { name: 'Remove shop.example.com' })).toBeInTheDocument();
  expect(screen.getByText('••••AB12')).toBeInTheDocument();
});

it('L3: removing a site asks first, then says it is done', async () => {
  answer({ 'GET /wconvert/v1/license': expired, 'DELETE /wconvert/v1/license/sites/shop.example.com': { ...expired, sites: expired.sites.slice(0, 1) } });
  render(<LicensePage />);
  await userEvent.click(await screen.findByRole('button', { name: 'Remove shop.example.com' }));
  await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Remove' }));

  await waitFor(() => expect(screen.getByText('shop.example.com was removed. One more site is free.')).toBeInTheDocument());
});

it('P1: a managed licence shows whether updates work and who to call — no sites, no key card', async () => {
  answer({ 'GET /wconvert/v1/license': { ...none, state: 'stopped', managed: { by: 'Acme Studio', email: 'help@acme.studio' }, badge: { href: '#license', label: null, prompt: false, tone: null, reason: null } } });
  render(<LicensePage />);

  expect(await screen.findByRole('heading', { name: 'Updates stopped' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'help@acme.studio' })).toHaveAttribute('href', 'mailto:help@acme.studio');
  expect(screen.queryByRole('region', { name: 'Sites' })).toBeNull();
  expect(screen.getByText(/WCONVERT_LICENSE_KEY/)).toBeInTheDocument();
});

it('a check that fails keeps the page and says so', async () => {
  let checks = 0;
  vi.mocked(apiFetch).mockImplementation(((options?: { path: string; method?: string }) => {
    if (options?.path === '/wconvert/v1/license?check=1') { checks += 1; return Promise.reject({ code: 'network_error', message: 'No route' }); }
    if (options?.path === '/wconvert/v1/license') return Promise.resolve(expired);
    return Promise.resolve({ updates: expired.updates });
  }) as never);
  render(<LicensePage />);
  await userEvent.click(await screen.findByRole('button', { name: 'Check now' }));

  expect(await screen.findByText('Couldn’t check the license just now.')).toBeInTheDocument();
  expect(checks).toBe(1);
  expect(screen.getByRole('heading', { name: 'Your license expired' })).toBeInTheDocument();
});

it('S10: a rate-limited key field opens again when the key is edited', async () => {
  answer({ 'GET /wconvert/v1/license': none, 'POST /wconvert/v1/license/activate': { code: 'rate_limited', data: { retry_after: 720 } } });
  render(<LicensePage />);
  await userEvent.click(await screen.findByText('Enter a license key instead'));
  await userEvent.type(screen.getByLabelText('License key'), 'WCV-RATE');
  await userEvent.click(screen.getByRole('button', { name: 'Activate' }));

  expect(await screen.findByText('Too many tries. Try again in 12 minutes.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Activate' })).toHaveAttribute('aria-disabled', 'true');
  await userEvent.type(screen.getByLabelText('License key'), '1');
  expect(screen.getByRole('button', { name: 'Activate' })).not.toHaveAttribute('aria-disabled');
});
