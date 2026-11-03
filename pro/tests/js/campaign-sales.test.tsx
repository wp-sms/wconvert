import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import apiFetch from '@wordpress/api-fetch';
import Revenue from '../../modules/analytics/admin/Revenue';
import { ReportNavigationProvider, useReportJump } from '@/stats/ReportNavigation';
vi.mock('@wordpress/api-fetch', () => ({ default: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const period = { days: 7, from: '2026-09-24', to: '2026-09-30' };
const report = { ...period, available: true, consent_ready: true, site_matches: true, settings: { enabled: true, since: '2026-09-01T00:00:00Z' }, complete: true, eligible_orders: 3, linked_orders: 1, currencies: [{ currency: 'USD', orders: 1, amount: 10, unallocated_refunds: 0 }], orders: [{ id: 42, campaign: 'offer', paid: '2026-09-25', status: 'completed', refunded: false, amount: 10, currency: 'USD', url: '/order/42' }] };
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

it('a failed tracking save offers Try again, and that saves again rather than re-reading', async () => {
  vi.mocked(apiFetch).mockResolvedValueOnce(report).mockRejectedValueOnce({ message: 'Nope' }).mockResolvedValueOnce({ settings: { ...report.settings, enabled: false } }).mockResolvedValue(report);
  render(<Revenue period={period} />);
  await userEvent.click(await screen.findByText('Tracking & setup'));
  await userEvent.click(screen.getByRole('button', { name: 'Turn off tracking' }));
  await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Turn off tracking' }));
  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('Could not save the tracking setting. Nope');
  const saves = () => vi.mocked(apiFetch).mock.calls.filter(([options]) => options?.method === 'POST');
  expect(saves()).toHaveLength(1);
  await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
  expect(saves()).toHaveLength(2);
  expect(saves()[1][0]).toMatchObject({ data: { enabled: false } });
  expect(screen.queryByRole('alert')).toBeNull();
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

describe('a switched-off Campaign sales section (ADR 0185)', () => {
  const off = { ...report, settings: { ...report.settings, enabled: false }, linked_orders: 0, currencies: [], orders: [] };
  const neverSetUp = { available: true, consent_ready: true, site_matches: false, settings: { enabled: false, since: null, home: '' } };
  const fold = () => screen.getByText('Campaign sales').closest('details');

  it('starts collapsed when tracking is off and the period has no linked orders, saying what it is', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(off);
    render(<Revenue period={period} />);
    await screen.findByText('Campaign sales');
    expect(fold()).not.toHaveAttribute('open');
    const row = fold()!.querySelector('summary')!;
    expect(row).toHaveTextContent('Campaign sales');
    expect(row).toHaveTextContent('Tracking is off');
    expect(row).toHaveTextContent('Paid orders linked to your campaigns.');
    expect(row.querySelector('svg.lucide-shopping-bag')).not.toBeNull();
    expect(screen.getByText('No linked orders in this period')).not.toBeVisible();
  });

  it('starts collapsed for a store that never turned it on, whose saved address is empty', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(neverSetUp);
    render(<Revenue period={period} />);
    await screen.findByText('Campaign sales');
    expect(fold()).not.toHaveAttribute('open');
    expect(screen.queryByRole('heading', { name: 'Campaign sales' })).toBeNull();
    await userEvent.click(screen.getByText('Campaign sales'));
    expect(fold()).toHaveAttribute('open');
    expect(screen.getByRole('button', { name: 'Turn on tracking' })).toBeVisible();
  });

  it('stays open while tracking is on, even with nothing linked', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ ...report, linked_orders: 0, currencies: [], orders: [] });
    render(<Revenue period={period} />);
    expect(await screen.findByRole('heading', { name: 'Campaign sales' })).toBeVisible();
    expect(fold()).toBeNull();
  });

  it('stays open when the period has linked orders, even with tracking off', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ ...report, settings: off.settings });
    render(<Revenue period={period} />);
    expect(await screen.findByRole('heading', { name: 'Campaign sales' })).toBeVisible();
    expect(screen.getByText('Linked paid orders')).toBeVisible();
  });

  it('stays open when the site address changed, because that needs fixing', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ ...off, site_matches: false });
    render(<Revenue period={period} />);
    expect(await screen.findByRole('heading', { name: 'Campaign sales' })).toBeVisible();
    expect(screen.getByText(/The site address changed/)).toBeVisible();
  });

  it('stays open when a report too large to total cannot say nothing was linked', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ ...off, complete: false });
    render(<Revenue period={period} />);
    expect(await screen.findByRole('heading', { name: 'Campaign sales' })).toBeVisible();
    expect(screen.getByText('Choose a shorter period')).toBeVisible();
  });

  it('stays open when the first read failed', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('offline'));
    render(<Revenue period={period} />);
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Campaign sales' })).toBeVisible();
  });

  it('cannot be folded over a read that failed after a collapsed one', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(off);
    const view = render(<Revenue period={period} />);
    await screen.findByText('Campaign sales');
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('offline'));
    view.rerender(<Revenue period={{ ...period, days: 30, from: '2026-09-01' }} />);
    const alert = await screen.findByRole('alert');
    expect(alert).toBeVisible();
    expect(fold()).toBeNull();
  });

  it('cannot be folded over a failed save', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(off).mockRejectedValueOnce({ message: 'Nope' });
    render(<Revenue period={period} />);
    await userEvent.click(await screen.findByText('Campaign sales'));
    await userEvent.click(screen.getByText('Tracking & setup'));
    await userEvent.click(screen.getByRole('button', { name: 'Turn on tracking' }));
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(fold()).toBeNull();
  });

  it('keeps the section open after tracking is turned off here, with its confirmation and focus', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ ...report, linked_orders: 0, currencies: [], orders: [] })
      .mockResolvedValueOnce({ settings: off.settings }).mockResolvedValueOnce(off);
    render(<Revenue period={period} />);
    await userEvent.click(await screen.findByText('Tracking & setup'));
    await userEvent.click(screen.getByRole('button', { name: 'Turn off tracking' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Turn off tracking' }));
    const again = await screen.findByRole('button', { name: 'Turn on tracking' });
    await waitFor(() => expect(vi.mocked(apiFetch)).toHaveBeenCalledTimes(3));
    expect(screen.getByRole('heading', { name: 'Campaign sales' })).toBeVisible();
    expect(fold()).toBeNull();
    expect(again).toBeVisible();
    await waitFor(() => expect(again).toHaveFocus());
  });

  it('puts focus back on the button when a slow save ends, because a busy button cannot hold it', async () => {
    let finish!: (value: unknown) => void;
    vi.mocked(apiFetch).mockResolvedValueOnce({ ...report, linked_orders: 0, currencies: [], orders: [] })
      .mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; })).mockResolvedValueOnce(off);
    render(<Revenue period={period} />);
    await userEvent.click(await screen.findByText('Tracking & setup'));
    await userEvent.click(screen.getByRole('button', { name: 'Turn off tracking' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Turn off tracking' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    const toggle = screen.getByRole('button', { name: 'Saving…' });
    expect(toggle).toBeDisabled();
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    expect(toggle).not.toHaveFocus();
    finish({ settings: off.settings });
    await waitFor(() => expect(toggle).toHaveFocus());
  });

  it('does not rebuild the section under the merchant when they turn tracking on from it', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(off)
      .mockResolvedValueOnce({ settings: report.settings }).mockResolvedValueOnce({ ...off, settings: report.settings });
    render(<Revenue period={period} />);
    await userEvent.click(await screen.findByText('Campaign sales'));
    await userEvent.click(screen.getByText('Tracking & setup'));
    const toggle = screen.getByRole('button', { name: 'Turn on tracking' });
    await userEvent.click(toggle);
    await waitFor(() => expect(toggle).toHaveTextContent('Turn off tracking'));
    expect(toggle).toBeInTheDocument();
    expect(toggle).toBeVisible();
    await waitFor(() => expect(toggle).toHaveFocus());
  });

  it('decides again for a new period, rather than holding what a save found', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(off)
      .mockResolvedValueOnce({ settings: report.settings }).mockResolvedValueOnce({ ...off, settings: report.settings });
    const view = render(<Revenue period={period} />);
    await userEvent.click(await screen.findByText('Campaign sales'));
    await userEvent.click(screen.getByText('Tracking & setup'));
    const toggle = screen.getByRole('button', { name: 'Turn on tracking' });
    await userEvent.click(toggle);
    await waitFor(() => expect(toggle).toHaveTextContent('Turn off tracking'));
    vi.mocked(apiFetch).mockResolvedValueOnce({ ...report, from: '2026-09-01', days: 30 });
    view.rerender(<Revenue period={{ ...period, days: 30, from: '2026-09-01' }} />);
    expect(await screen.findByRole('heading', { name: 'Campaign sales' })).toBeVisible();
    expect(fold()).toBeNull();
  });

  it('starts one campaign collapsed even after the overview was opened, because it is a new report', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(off).mockResolvedValueOnce(off);
    const view = render(<Revenue period={period} />);
    await userEvent.click(await screen.findByText('Campaign sales'));
    expect(fold()).toHaveAttribute('open');
    view.rerender(<Revenue period={period} optinId="offer" />);
    await screen.findByText('Campaign sales');
    await waitFor(() => expect(vi.mocked(apiFetch)).toHaveBeenCalledTimes(2));
    expect(fold()).not.toHaveAttribute('open');
  });

  it('opens when something jumps to it', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(off);
    function JumpToSales() {
      const target = useReportJump('sales');
      return <button type="button" onClick={() => { const element = document.getElementById(target!.controls)!; element.scrollIntoView = vi.fn(); target!.jump(); }}>Go</button>;
    }
    render(<ReportNavigationProvider><JumpToSales /><Revenue period={period} /></ReportNavigationProvider>);
    await screen.findByText('Campaign sales');
    expect(fold()).not.toHaveAttribute('open');
    await userEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(fold()).toHaveAttribute('open');
    expect(screen.getByRole('group', { name: 'Sales' })).toHaveFocus();
  });

  it('behaves the same on one campaign', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(off);
    render(<Revenue period={period} optinId="offer" />);
    await screen.findByText('Campaign sales');
    expect(fold()).not.toHaveAttribute('open');
  });
});
