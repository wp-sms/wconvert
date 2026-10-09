import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import apiFetch from '@wordpress/api-fetch';
import Revenue from '../../modules/analytics/admin/Revenue';
vi.mock('@wordpress/api-fetch', () => ({ default: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const period = { days: 7, from: '2026-09-24', to: '2026-09-30' };
const report = { ...period, guide_url: '/guide', available: true, consent_ready: true, site_matches: true, settings: { enabled: true, since: '2026-09-01T00:00:00Z' }, complete: true, eligible_orders: 3, linked_orders: 1, currencies: [{ currency: 'USD', orders: 1, amount: 10, unallocated_refunds: 0 }], orders: [{ id: 42, campaign: 'offer', paid: '2026-09-25', status: 'completed', refunded: false, amount: 10, currency: 'USD', url: '/order/42' }] };
it('retains accepted totals, dates and campaign links after a failed period change', async () => {
  vi.mocked(apiFetch).mockResolvedValueOnce(report);
  const view = render(<Revenue period={period} campaignNames={{ offer: 'Autumn offer' }} />);
  await screen.findByText('Linked paid orders');
  expect(screen.getByText('Linked after a signup or eligible click within 30 minutes. A link does not prove the campaign caused the sale.')).toBeVisible();
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
  const confirm = screen.getByRole('alertdialog');
  expect(confirm).toHaveTextContent('Orders already linked stay in this report.');
  await userEvent.click(within(confirm).getByRole('button', { name: 'Turn off tracking' }));
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

it('shows linked orders in the store currency with readable status and date, and no campaign ID', async () => {
  document.documentElement.lang = 'en-US';
  vi.mocked(apiFetch).mockResolvedValueOnce({ ...report, orders: [
    { ...report.orders[0], status: 'wc-processing', amount: 1240.5 },
    { ...report.orders[0], id: 43, campaign: 'gone', status: 'wc-custom-review' },
  ] });
  render(<Revenue period={period} campaignNames={{ offer: 'Autumn offer' }} />);
  await userEvent.click(await screen.findByText('View linked orders'));
  const rows = within(screen.getByRole('table', { name: 'Linked orders' })).getAllByRole('row');
  expect(rows[1]).toHaveTextContent('Processing');
  expect(rows[1]).toHaveTextContent('$1,240.50');
  expect(rows[1]).toHaveTextContent('Sep 25, 2026');
  expect(rows[2]).toHaveTextContent('Other status');
  expect(rows[2]).toHaveTextContent('Deleted campaign');
  expect(rows[2]).not.toHaveTextContent('gone');
  expect(within(rows[2]).queryByRole('link', { name: /Deleted campaign/ })).toBeNull();
  expect(screen.getAllByText('$10.00', { selector: 'dd' })).toHaveLength(2);
});

it('hands the overview a Linked sales summary only for a complete report of these dates', async () => {
  const onSummary = vi.fn();
  vi.mocked(apiFetch).mockResolvedValueOnce({ ...report, linked_orders: 18, currencies: [{ currency: 'EUR', orders: 18, amount: 1240, unallocated_refunds: 0 }] });
  const view = render(<Revenue period={period} onSummary={onSummary} />);
  await screen.findByText('Linked paid orders');
  expect(onSummary).toHaveBeenLastCalledWith({ orders: 18, amount: 1240, currency: 'EUR' });
  vi.mocked(apiFetch).mockResolvedValueOnce({ ...report, from: '2026-09-01', days: 30, complete: false });
  view.rerender(<Revenue period={{ ...period, days: 30, from: '2026-09-01' }} onSummary={onSummary} />);
  await screen.findByText('Choose a shorter period');
  expect(onSummary).toHaveBeenLastCalledWith(null);
});

it('reads Today live, which the order report would otherwise read as complete days', async () => {
  vi.mocked(apiFetch).mockResolvedValueOnce({ ...report, from: '2026-10-09', to: '2026-10-09', days: 1, linked_orders: 0, orders: [] });
  render(<Revenue period={{ days: 1, from: '2026-10-09', to: '2026-10-09', complete_days: false }} />);
  await screen.findByText('No linked orders in this period');
  expect(vi.mocked(apiFetch).mock.calls[0][0].path).toBe('/wconvert/v1/revenue?days=1&complete=0');
  expect(screen.queryByText(/appears tomorrow/)).toBeNull();
});
