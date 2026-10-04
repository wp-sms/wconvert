import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import apiFetch from '@wordpress/api-fetch';
import Revenue from '../../modules/analytics/admin/Revenue';
vi.mock('@wordpress/api-fetch', () => ({ default: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const period = { days: 7, from: '2026-09-24', to: '2026-09-30' };
const report = { ...period, guide_url: '/guide', available: true, consent_ready: true, site_matches: true, settings: { enabled: true, since: '2026-09-01T00:00:00Z' }, complete: true, eligible_orders: 3, linked_orders: 1, currencies: [{ currency: 'USD', orders: 1, amount: 10, unallocated_refunds: 0 }], orders: [{ id: 42, campaign: 'offer', paid: '2026-09-25', status: 'Completed', refunded: false, amount: 10, currency: 'USD', url: '/order/42' }] };
it('retains accepted totals, dates and campaign links after a failed period change', async () => {
  vi.mocked(apiFetch).mockResolvedValueOnce(report);
  const view = render(<Revenue period={period} campaignNames={{ offer: 'Autumn offer' }} />);
  await screen.findByText('Linked paid orders');
  vi.mocked(apiFetch).mockRejectedValueOnce(new Error('offline'));
  view.rerender(<Revenue period={{ ...period, days: 30, from: '2026-09-01' }} campaignNames={{ offer: 'Autumn offer' }} />);
  await screen.findByRole('alert');
  await userEvent.click(screen.getByText('View linked orders'));
  const link = screen.getByRole('link', { name: 'Autumn offer' });
  expect(link.getAttribute('href')).toContain('days=7');
  expect(screen.getByText(/Sep 24.*30, 2026/)).toBeInTheDocument();
});
it('keeps a confirmed tracking setting when the following report refresh fails', async () => {
  vi.mocked(apiFetch).mockResolvedValueOnce(report).mockResolvedValueOnce({ settings: { ...report.settings, enabled: false } }).mockRejectedValueOnce(new Error('offline'));
  render(<Revenue period={period} />);
  await userEvent.click(await screen.findByText('Tracking & setup'));
  await userEvent.click(screen.getByRole('button', { name: 'Turn off tracking' }));
  await screen.findByRole('alert');
  expect(screen.getAllByText('Tracking is off')).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'Turn on tracking' })).toBeEnabled();
  expect(screen.getByText('Linked paid orders')).toBeInTheDocument();
});

it('keeps currencies separate and explains an unavailable refund amount', async () => {
  vi.mocked(apiFetch).mockResolvedValueOnce({ ...report, currencies: [...report.currencies, { currency: 'EUR', orders: 2, amount: null, unallocated_refunds: 1 }] });
  render(<Revenue period={period} />);
  const table = await screen.findByRole('table', { name: 'Linked product revenue by currency' });
  expect(table).toHaveTextContent('USD'); expect(table).toHaveTextContent('EUR');
  expect(table).toHaveTextContent('A refund has no product allocation.');
  expect(screen.getAllByRole('cell', { name: 'Unavailable' })).toHaveLength(1);
  expect(screen.queryByText('Linked paid orders')).not.toBeInTheDocument();
});
