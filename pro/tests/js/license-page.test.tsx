import { beforeEach, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import apiFetch from '@wordpress/api-fetch';
import { LicensePage } from '../../resources/admin/src/license/LicensePage';
import { LicenseSkeleton } from '../../resources/admin/src/license/LicenseSkeleton';
import type { LicensePayload } from '../../resources/admin/src/license/describeLicense';

vi.mock('@wordpress/api-fetch', () => ({ default: vi.fn() }));

const none: LicensePayload = {
  state: 'none', error_code: '', retry_at: null, plan: null, expires_at: null, days_left: null, renewal: null, sites: [],
  key: { masked: null, source: null }, buyer: null, domain_change: null,
  updates: { installed: '1.4.2', latest: '1.4.2', file_mods: true, update_url: null, checked_at: null },
  last_checked_at: null, last_success_at: null, reach: 'ok',
  urls: { account: 'https://my.wconvert.io/account', checkout: 'https://wconvert.io/pricing/', support: 'https://wconvert.io/support/' },
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

it('M3: expired — renew with the coupon, sites and the key below', async () => {
  answer({ 'GET /wconvert/v1/license': expired });
  render(<LicensePage />);

  expect(await screen.findByRole('heading', { name: 'Your license expired' })).toBeInTheDocument();
  expect(screen.getByText(/Pro features keep working\./)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Renew/ })).toHaveAttribute('href', 'https://my.wconvert.io/renew');
  expect(screen.getByText('RENEW20')).toBeInTheDocument();
  // A region's heading is its name (`Region.tsx`), so it is found by that.
  const sites = screen.getByRole('heading', { name: 'Sites' }).closest('section')!;
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
  // The merchant asked for this answer, so it is where focus lands.
  expect(screen.getByRole('status')).toHaveFocus();
});

it('a site is a row of the shared table: its domain names the row, and Remove is the actions cell', async () => {
  answer({ 'GET /wconvert/v1/license': expired });
  render(<LicensePage />);
  const remove = await screen.findByRole('button', { name: 'Remove shop.example.com' });
  const row = remove.closest('tr')!;

  expect(remove.closest('td')).toHaveClass('wconvert-table__actions');
  expect(row.querySelector('td[data-card="heading"]')).toHaveTextContent('shop.example.com');
});

it('a door with no address is not drawn, rather than opening a dead tab', async () => {
  answer({ 'GET /wconvert/v1/license': { ...expired, urls: {} } });
  render(<LicensePage />);

  expect(await screen.findByRole('heading', { name: 'Your license expired' })).toBeInTheDocument();
  expect(document.querySelector('a[href="#"]')).toBeNull();
  expect(screen.queryByRole('link', { name: /Renew/ })).toBeNull();
  expect(screen.queryByRole('link', { name: /Upgrade/ })).toBeNull();
});

it('the search box is the shared one, whose text clears its icon on a long list', async () => {
  const sites = Array.from({ length: 11 }, (_, index) => ({ domain: `site${index}.example.com`, here: false, dev: false, added: null, last_seen: null }));
  answer({ 'GET /wconvert/v1/license': { ...expired, sites } });
  render(<LicensePage />);
  const search = await screen.findByLabelText('Search sites');

  expect(search).toHaveClass('ps-9');
  await userEvent.type(search, 'site7');
  expect(screen.getByRole('button', { name: 'Remove site7.example.com' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Remove site1.example.com' })).toBeNull();
});

it('P1: a managed licence shows whether updates work and who to call — no sites, no key card', async () => {
  answer({ 'GET /wconvert/v1/license': { ...none, state: 'stopped', managed: { by: 'Acme Studio', email: 'help@acme.studio' }, badge: { href: '#license', label: null, prompt: false, tone: null, reason: null } } });
  render(<LicensePage />);

  expect(await screen.findByRole('heading', { name: 'Updates stopped' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'help@acme.studio' })).toHaveAttribute('href', 'mailto:help@acme.studio');
  expect(screen.queryByRole('heading', { name: 'Sites' })).toBeNull();
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

  expect(await screen.findByText('Could not check the license just now. No route')).toBeInTheDocument();
  expect(checks).toBe(1);
  expect(screen.getByRole('heading', { name: 'Your license expired' })).toBeInTheDocument();
});

it('a check that fails on coming back to the tab says so without moving focus, and offers Try again', async () => {
  let checks = 0;
  vi.mocked(apiFetch).mockImplementation(((options?: { path: string; method?: string }) => {
    if (options?.path === '/wconvert/v1/license?check=1') { checks += 1; return checks === 1 ? Promise.reject({ code: 'network_error', message: 'No route' }) : Promise.resolve(expired); }
    if (options?.path === '/wconvert/v1/license') return Promise.resolve(expired);
    return Promise.resolve({ updates: expired.updates });
  }) as never);
  render(<LicensePage />);
  const check = await screen.findByRole('button', { name: 'Check now' });
  check.focus();
  await act(async () => { window.dispatchEvent(new Event('focus')); });

  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('Could not check the license just now.');
  expect(check).toHaveFocus();
  await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  expect(checks).toBe(2);
});

it('a first read that fails is the page’s whole content, and Try again reads it again', async () => {
  vi.mocked(apiFetch).mockRejectedValueOnce({ code: 'x', message: 'The server is away.' }).mockResolvedValue(expired);
  render(<LicensePage />);
  expect(await screen.findByText('The server is away.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('heading', { name: 'Your license expired' })).toBeInTheDocument();
});

it('an action that fails keeps its door, and Try again repeats that action', async () => {
  let removals = 0;
  vi.mocked(apiFetch).mockImplementation(((options?: { path: string; method?: string }) => {
    if (options?.method === 'DELETE') { removals += 1; return removals === 1 ? Promise.reject({ code: 'network_error' }) : Promise.resolve({ ...expired, sites: expired.sites.slice(0, 1) }); }
    return Promise.resolve(options?.path === '/wconvert/v1/license' ? expired : { signed_in: false, licenses: [] });
  }) as never);
  render(<LicensePage />);
  await userEvent.click(await screen.findByRole('button', { name: 'Remove shop.example.com' }));
  await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Remove' }));

  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('Could not reach the license server.');
  expect(within(alert).getByRole('link', { name: /Troubleshooting guide/ })).toBeInTheDocument();
  await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(screen.getByText('shop.example.com was removed. One more site is free.')).toBeInTheDocument());
  expect(removals).toBe(2);
});

it('the placeholder is the shape that lands: one card to activate, otherwise status over two columns', () => {
  window.wconvertAdmin = { exportUrl: '', planBadge: { ...none.badge, prompt: true } } as never;
  const narrow = render(<LicenseSkeleton />);
  expect(narrow.container.querySelector('.wconvert-license--narrow')).not.toBeNull();
  expect(narrow.container.querySelector('.wconvert-license-grid')).toBeNull();
  narrow.unmount();

  window.wconvertAdmin = { exportUrl: '', planBadge: expired.badge } as never;
  const full = render(<LicenseSkeleton />);
  expect(full.container.querySelector('.wconvert-license--narrow')).toBeNull();
  expect(full.container.querySelector('.wconvert-license-grid')?.children).toHaveLength(2);
  expect(screen.getAllByRole('status')).toHaveLength(1);
  full.unmount();
  delete window.wconvertAdmin;
});

it('S10: a rate-limited key field opens again when the key is edited', async () => {
  answer({ 'GET /wconvert/v1/license': none, 'POST /wconvert/v1/license/activate': { code: 'rate_limited', data: { retry_after: 720 } } });
  render(<LicensePage />);
  await userEvent.click(await screen.findByText('Enter a license key instead'));
  await userEvent.type(screen.getByLabelText('License key'), 'WCV-RATE');
  await userEvent.click(screen.getByRole('button', { name: 'Activate' }));

  expect(await screen.findByText('Too many tries. Try again in 12 minutes.')).toBeInTheDocument();
  const refused = screen.getByRole('button', { name: 'Activate' });
  expect(refused).toHaveAttribute('aria-disabled', 'true');
  expect(refused).toBeEnabled();
  expect(refused).toHaveAccessibleDescription(/Too many tries/);
  await userEvent.type(screen.getByLabelText('License key'), '1');
  expect(screen.getByRole('button', { name: 'Activate' })).not.toHaveAttribute('aria-disabled');
});

it('busy is the real attribute: an activation in flight gets out of the way, it is not a refusal', async () => {
  let finish: (value: unknown) => void = () => {};
  vi.mocked(apiFetch).mockImplementation(((options?: { path: string; method?: string }) => {
    if (!options) return Promise.resolve(undefined);
    if (options.method === 'POST') return new Promise((resolve) => { finish = resolve; });
    return options.path.endsWith('/account') ? Promise.resolve({ signed_in: false, email_masked: null, licenses: [], error_code: null, message: null }) : Promise.resolve(none);
  }) as never);
  render(<LicensePage />);
  await userEvent.click(await screen.findByText('Enter a license key instead'));
  await userEvent.type(screen.getByLabelText('License key'), 'WCV-BUSY');
  await userEvent.click(screen.getByRole('button', { name: 'Activate' }));
  const busy = await screen.findByRole('button', { name: 'Activating…' });
  expect(busy).toBeDisabled();
  expect(busy).not.toHaveAttribute('aria-disabled');
  finish(none);
});

it('every license full: Activate stays reachable, says why, and declines', async () => {
  answer({ 'GET /wconvert/v1/license': none, 'GET /wconvert/v1/license/account': {
    signed_in: true, email_masked: 's***@example.com', error_code: null, message: null,
    licenses: [{ id: 'one', key_masked: '••••AB12', max: 1, used: 1, full: true, ends_at: null }],
  } });
  render(<LicensePage />);
  const activate = await screen.findByRole('button', { name: 'Activate on this site' });
  expect(activate).toHaveAttribute('aria-disabled', 'true');
  expect(activate).toHaveAccessibleDescription(/Every license on this account is in use/);
  await userEvent.click(activate);
  expect(activate).toHaveFocus();
  expect(vi.mocked(apiFetch).mock.calls.some(([options]) => (options as { method?: string } | undefined)?.method === 'POST')).toBe(false);
});

it('an expired key offers Renew beside sign-in without a second brand button', async () => {
  answer({ 'GET /wconvert/v1/license': none, 'POST /wconvert/v1/license/activate': { code: 'license_expired' } });
  render(<LicensePage />);
  await userEvent.click(await screen.findByText('Enter a license key instead'));
  await userEvent.type(screen.getByLabelText('License key'), 'WCV-OLD');
  await userEvent.click(screen.getByRole('button', { name: 'Activate' }));
  const renew = await screen.findByRole('link', { name: /Renew/ });
  expect(renew).toHaveAttribute('data-variant', 'outline');
  expect(document.querySelectorAll('[data-variant="brand"]')).toHaveLength(1);
});

it('L5: a swapped key leaves the swap box empty and closed, not offering the new key for itself', async () => {
  answer({ 'GET /wconvert/v1/license': expired, 'POST /wconvert/v1/license/replace': { ...expired, key: { masked: '••••CD34', source: 'manual' } } });
  render(<LicensePage />);
  await userEvent.click(await screen.findByText('Use a different key'));
  await userEvent.type(screen.getByLabelText('New license key'), 'WCV-NEW-CD34');
  await userEvent.click(within(screen.getByLabelText('New license key').closest('form')!).getByRole('button', { name: 'Activate' }));

  expect(await screen.findByText('The new key is active')).toBeInTheDocument();
  expect(screen.getByText('••••CD34')).toBeInTheDocument();
  expect(screen.getByLabelText('New license key')).toHaveValue('');
  expect(screen.getByText('Use a different key').closest('details')).not.toHaveAttribute('open');
});
